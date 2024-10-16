import type Pyodide from "pyodide";
import type { PyProxy, PyBuffer } from "pyodide/ffi";
import { PromiseDelegate } from "@stlite/common";
import { writeFileWithParents, renameWithParents } from "./file";
import { validateRequirements } from "@stlite/common/src/requirements";
import { initPyodide } from "./pyodide-loader";
import { mockPyArrow } from "./mock";
import { tryModuleAutoLoad } from "./module-auto-load";
import type {
  WorkerInitialData,
  OutMessage,
  InMessage,
  ReplyMessage,
  PyodideConvertiblePrimitive,
} from "./types";
import {
  handleAutoComplete,
  handleHover,
  importLanguageServerPythonLibraries,
} from "./cognite/language-server-utils";
import { LanguageServerEvents } from "./cognite/language-server-types";

let tokenIsSet = false;

export type PostMessageFn = (message: OutMessage, port?: MessagePort) => void;

const self = global as typeof globalThis & {
  __logCallback__: (levelno: number, msg: string) => void;
  __streamlitFlagOptions__: Record<string, PyodideConvertiblePrimitive>;
  __scriptFinishedCallback__: () => void;
  __moduleAutoLoadPromise__: Promise<unknown> | undefined;
};

function dispatchModuleAutoLoading(
  pyodide: Pyodide.PyodideInterface,
  postMessage: PostMessageFn,
  sources: string[],
): void {
  const autoLoadPromise = tryModuleAutoLoad(pyodide, postMessage, sources);
  // `autoInstallPromise` will be awaited in the script_runner on the Python side.
  self.__moduleAutoLoadPromise__ = autoLoadPromise;
  pyodide.runPythonAsync(`
from streamlit.runtime.scriptrunner import script_runner
from js import __moduleAutoLoadPromise__

script_runner.moduleAutoLoadPromise = __moduleAutoLoadPromise__
`);
}

export function startWorkerEnv(
  defaultPyodideUrl: string,
  postMessage: PostMessageFn,
  presetInitialData?: Partial<WorkerInitialData>,
) {
  function postProgressMessage(message: string): void {
    postMessage({
      type: "event:progress",
      data: {
        message,
      },
    });
  }

  let pyodide: Pyodide.PyodideInterface;

  let httpServer: PyProxy;

  const initDataPromiseDelegate = new PromiseDelegate<WorkerInitialData>();

  /**
   * Load Pyodided and initialize the interpreter.
   *
   * NOTE: This implementation is based on JupyterLite@v0.1.0a16.
   *       Since v0.1.0a17, a wrapper around micropip, piplite, has been introduced
   *       and the importing strategy of pyolite and other packages has been changed.
   *       We might need to catch up it.
   *       https://github.com/jupyterlite/jupyterlite/pull/310
   */
  async function loadPyodideAndPackages() {
    const initialDataFromMessage = await initDataPromiseDelegate.promise;
    const initData = {
      ...presetInitialData,
      ...initialDataFromMessage,
    };
    console.debug("Initial data", initData);
    const {
      entrypoint,
      files,
      archives,
      requirements: unvalidatedRequirements,
      prebuiltPackageNames: prebuiltPackages,
      wheels,
      pyodideUrl = defaultPyodideUrl,
      streamlitConfig,
      idbfsMountpoints,
      nodefsMountpoints,
      moduleAutoLoad,
    } = initData;

    const requirements = validateRequirements(unvalidatedRequirements); // Blocks the not allowed wheel URL schemes.

    postProgressMessage("Loading Pyodide.");

    console.debug("Loading Pyodide");
    pyodide = await initPyodide(pyodideUrl, {
      stdout: console.log,
      stderr: console.error,
    });
    console.debug("Loaded Pyodide");

    let useIdbfs = false;
    if (idbfsMountpoints) {
      useIdbfs = true;

      idbfsMountpoints.forEach((mountpoint) => {
        pyodide.FS.mkdir(mountpoint);
        pyodide.FS.mount(pyodide.FS.filesystems.IDBFS, {}, mountpoint);
      });

      await new Promise<void>((resolve, reject) => {
        pyodide.FS.syncfs(true, (err: Error) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
    }
    if (nodefsMountpoints) {
      Object.entries(nodefsMountpoints).forEach(([mountpoint, path]) => {
        pyodide.FS.mkdir(mountpoint);
        pyodide.FS.mount(
          pyodide.FS.filesystems.NODEFS,
          { root: path },
          mountpoint,
        );
      });
    }

    // Mount files
    postProgressMessage("Mounting files.");
    const pythonFilePaths: string[] = [];
    await Promise.all(
      Object.keys(files).map(async (path) => {
        const file = files[path];

        let data: string | ArrayBufferView;
        if ("url" in file) {
          console.debug(`Fetch a file from ${file.url}`);
          data = await fetch(file.url)
            .then((res) => res.arrayBuffer())
            .then((buffer) => new Uint8Array(buffer));
        } else {
          data = file.data;
        }
        const { opts } = files[path];

        console.debug(`Write a file "${path}"`);
        writeFileWithParents(pyodide, path, data, opts);

        if (path.endsWith(".py")) {
          pythonFilePaths.push(path);
        }
      }),
    );

    // Unpack archives
    postProgressMessage("Unpacking archives.");
    await Promise.all(
      archives.map(async (archive) => {
        let buffer: Parameters<Pyodide.PyodideInterface["unpackArchive"]>[0];
        if ("url" in archive) {
          console.debug(`Fetch an archive from ${archive.url}`);
          buffer = await fetch(archive.url).then((res) => res.arrayBuffer());
        } else {
          buffer = archive.buffer;
        }
        const { format, options } = archive;

        console.debug(`Unpack an archive`, { format, options });
        pyodide.unpackArchive(buffer, format, options);
      }),
    );

    await pyodide.loadPackage("micropip");
    const micropip = pyodide.pyimport("micropip");

    postProgressMessage("Mocking some packages.");
    console.debug("Mock pyarrow");
    mockPyArrow(pyodide);
    console.debug("Mocked pyarrow");

    // NOTE: Installing packages must be AFTER restoring the archives
    // because they may contain packages to be restored into the site-packages directory.
    postProgressMessage("Installing packages.");

    console.debug("Installing the prebuilt packages:", prebuiltPackages);
    await pyodide.loadPackage(prebuiltPackages);
    console.debug("Installed the prebuilt packages");

    if (wheels) {
      console.debug(
        "Installing the wheels:",
        wheels,
        "and the requirements:",
        requirements,
      );
      // NOTE: It's important to install the user-specified requirements
      // and the custom Streamlit and stlite wheels in the same `micropip.install` call,
      // which satisfies the following two requirements:
      // 1. It allows users to specify the versions of Streamlit's dependencies via requirements.txt
      // before these versions are automatically resolved by micropip when installing Streamlit from the custom wheel
      // (installing the user-reqs must be earlier than or equal to installing the custom wheels).
      // 2. It also resolves the `streamlit` package version required by the user-specified requirements to the appropriate version,
      // which avoids the problem of https://github.com/whitphx/stlite/issues/675
      // (installing the custom wheels must be earlier than or equal to installing the user-reqs).
      await micropip.install.callKwargs(
        [wheels.stliteLib, wheels.streamlit, ...requirements],
        { keep_going: true },
      );
      console.debug("Installed the wheels and the requirements");
    } else {
      console.debug("Installing the requirements:", requirements);
      await micropip.install.callKwargs(requirements, { keep_going: true });
      console.debug("Installed the requirements");
    }
    if (moduleAutoLoad) {
      const sources = pythonFilePaths.map((path) =>
        pyodide.FS.readFile(path, { encoding: "utf8" }),
      );
      dispatchModuleAutoLoading(pyodide, postMessage, sources);
    }

    // Halt execution until CDF token is set
    while (!tokenIsSet) {
      // Wait for Fusion to send token
      await new Promise((r) => setTimeout(r, 50));
    }

    // The following code is necessary to avoid errors like `NameError: name '_imp' is not defined`
    // at importing installed packages.
    await pyodide.runPythonAsync(`
import importlib
importlib.invalidate_caches()
`);

    postProgressMessage("Loading streamlit package.");
    console.debug("Loading the Streamlit package");
    // Importing the `streamlit` module takes most of the time,
    // so we first run this step independently for clearer logs and easy exec-time profiling.
    // For https://github.com/whitphx/stlite/issues/427
    await pyodide.runPythonAsync(`
import streamlit.runtime
    `);
    console.debug("Loaded the Streamlit package");

    postProgressMessage("Setting up the loggers.");
    console.debug("Setting the loggers");
    // Fix the Streamlit's logger instantiating strategy, which violates the standard and is problematic for us.
    // See https://github.com/streamlit/streamlit/issues/4742
    await pyodide.runPythonAsync(`
import logging
import streamlit.logger

streamlit.logger.get_logger = logging.getLogger
streamlit.logger.setup_formatter = None
streamlit.logger.update_formatter = lambda *a, **k: None
streamlit.logger.set_log_level = lambda *a, **k: None

for name in streamlit.logger._loggers.keys():
    if name == "root":
        name = "streamlit"
    logger = logging.getLogger(name)
    logger.propagate = True
    logger.handlers.clear()
    logger.setLevel(logging.NOTSET)

streamlit.logger._loggers = {}
`);
    // Then configure the logger.
    const logCallback = (levelno: number, msg: string) => {
      if (levelno >= 40) {
        console.error(msg);
      } else if (levelno >= 30) {
        console.warn(msg);
      } else if (levelno >= 20) {
        console.info(msg);
      } else {
        console.debug(msg);
      }
    };
    self.__logCallback__ = logCallback;
    await pyodide.runPythonAsync(`
def setup_loggers(streamlit_level, streamlit_message_format):
    from js import __logCallback__


    class JsHandler(logging.Handler):
        def emit(self, record):
            msg = self.format(record)
            __logCallback__(record.levelno, msg)


    root_message_format = "%(levelname)s:%(name)s:%(message)s"

    root_logger = logging.getLogger()
    root_logger.handlers.clear()
    root_formatter = logging.Formatter(root_message_format)
    root_handler = JsHandler()
    root_handler.setFormatter(root_formatter)
    root_logger.addHandler(root_handler)
    root_logger.setLevel(logging.DEBUG)

    streamlit_logger = logging.getLogger("streamlit")
    streamlit_logger.propagate = False
    streamlit_logger.handlers.clear()
    streamlit_formatter = logging.Formatter(streamlit_message_format)
    streamlit_handler = JsHandler()
    streamlit_handler.setFormatter(streamlit_formatter)
    streamlit_logger.addHandler(streamlit_handler)
    streamlit_logger.setLevel(streamlit_level.upper())
`);
    const streamlitLogLevel = (
      streamlitConfig?.["logger.level"] ?? "INFO"
    ).toString();
    const streamlitLogMessageFormat =
      streamlitConfig?.["logger.messageFormat"] ?? "%(asctime)s %(message)s";
    const setupLoggers = pyodide.globals.get("setup_loggers");
    setupLoggers(streamlitLogLevel, streamlitLogMessageFormat);
    console.debug("Set the loggers");

    postProgressMessage(
      "Mocking some Streamlit functions for the browser environment.",
    );
    console.debug("Mocking some Streamlit functions");
    // Disable caching. See https://github.com/whitphx/stlite/issues/495
    await pyodide.runPythonAsync(`
import streamlit

def is_cacheable_msg(msg):
    return False

streamlit.runtime.runtime.is_cacheable_msg = is_cacheable_msg
`);
    console.debug("Mocked some Streamlit functions");

    postProgressMessage("Importing Language Server");
    await importLanguageServerPythonLibraries(pyodide, micropip);

    if (useIdbfs) {
      postProgressMessage("Setting up the IndexedDB filesystem synchronizer.");
      console.debug("Setting up the IndexedDB filesystem synchronizer");
      // IDBFS needs to be synced by calling `pyodide.FS.syncfs`.
      // Ref: https://emscripten.org/docs/api_reference/Filesystem-API.html#filesystem-api-idbfs
      let fsSyncing = false; // Sometimes `__scriptFinishedCallback__` is called many time at once so we avoid unnecessary simultaneous calls of `pyodide.FS.syncfs`.
      self.__scriptFinishedCallback__ = () => {
        console.debug("The script has finished. Syncing the filesystem.");
        if (!fsSyncing) {
          fsSyncing = true;
          pyodide.FS.syncfs(false, (err: Error) => {
            fsSyncing = false;
            if (err) {
              console.error(err);
            }
          });
        }
      };
      // Monkey-patch the `AppSession._on_scriptrunner_event` method to call `__scriptFinishedCallback__` when the script is finished.
      await pyodide.runPythonAsync(`
from streamlit.runtime.app_session import AppSession
from streamlit.runtime.scriptrunner import ScriptRunnerEvent
from js import __scriptFinishedCallback__

def wrap_app_session_on_scriptrunner_event(original_method):
    def wrapped(self, *args, **kwargs):
        if "event" in kwargs:
            event = kwargs["event"]
            if event == ScriptRunnerEvent.SCRIPT_STOPPED_WITH_SUCCESS or event == ScriptRunnerEvent.SCRIPT_STOPPED_FOR_RERUN or event == ScriptRunnerEvent.SHUTDOWN:
                __scriptFinishedCallback__()
        return original_method(self, *args, **kwargs)
    return wrapped

AppSession._on_scriptrunner_event = wrap_app_session_on_scriptrunner_event(AppSession._on_scriptrunner_event)
`);
      console.debug("Set up the IndexedDB filesystem synchronizer");
    }

    postProgressMessage("Booting up the Streamlit server.");
    // The following Python code is based on streamlit.web.cli.main_run().
    console.debug("Setting up the Streamlit configuration");
    self.__streamlitFlagOptions__ = {
      // gatherUsageStats is disabled as default, but can be enabled explicitly by setting it to true.
      "browser.gatherUsageStats": false,
      ...streamlitConfig,
      "runner.fastReruns": false, // Fast reruns do not work well with the async script runner of stlite. See https://github.com/whitphx/stlite/pull/550#issuecomment-1505485865.
    };
    await pyodide.runPythonAsync(`
from stlite_lib.bootstrap import load_config_options, prepare
from js import __streamlitFlagOptions__

flag_options = __streamlitFlagOptions__.to_py()
load_config_options(flag_options)

main_script_path = "${entrypoint}"
args = []

prepare(main_script_path, args)
`);
    console.debug("Set up the Streamlit configuration");

    console.debug("Booting up the Streamlit server");
    const Server = pyodide.pyimport("stlite_lib.server.Server");
    httpServer = Server(entrypoint);
    await httpServer.start();
    console.debug("Booted up the Streamlit server");

    postMessage({
      type: "event:loaded",
    });

    return initData;
  }

  const pyodideReadyPromise = loadPyodideAndPackages().catch((error) => {
    postMessage({
      type: "event:error",
      data: {
        error,
      },
    });
    throw error;
  });

  /**
   * Process a message sent to the worker.
   *
   * @param event The message event to process
   */
  const onmessage = async (event: MessageEvent<InMessage>): Promise<void> => {
    const msg = event.data;

    // Special case for transmitting the initial data
    if (msg.type === "initData") {
      initDataPromiseDelegate.resolve(msg.data);
      return;
    }

    const pyodidePromise = (async () => {
      while (!pyodide) {
        await new Promise((r) => setTimeout(r, 50));
      }
      return pyodide;
    })();
    handleCogniteMessage(pyodidePromise, msg);

    const { moduleAutoLoad } = await pyodideReadyPromise;

    const messagePort = event.ports[0];
    function reply(message: ReplyMessage): void {
      messagePort.postMessage(message);
    }

    try {
      switch (msg.type) {
        case "reboot": {
          console.debug("Reboot the Streamlit server", msg.data);

          const { entrypoint } = msg.data;

          httpServer.stop();

          console.debug("Booting up the Streamlit server");
          const Server = pyodide.pyimport("stlite_lib.server.Server");
          httpServer = Server(entrypoint);
          httpServer.start();
          console.debug("Booted up the Streamlit server");

          reply({
            type: "reply",
          });
          break;
        }
        case "websocket:connect": {
          console.debug("websocket:connect", msg.data);

          const { path } = msg.data;

          httpServer.start_websocket(
            path,
            (message: PyBuffer | string, binary: boolean) => {
              // XXX: Now there is no session mechanism

              if (binary) {
                const messageProxy = message as PyBuffer;
                const buffer = messageProxy.getBuffer("u8");
                messageProxy.destroy();
                const payload = new Uint8ClampedArray(
                  buffer.data.buffer,
                  buffer.data.byteOffset,
                  buffer.data.byteLength,
                );
                postMessage({
                  type: "websocket:message",
                  data: {
                    payload: new Uint8Array(payload),
                  },
                });
              } else {
                const messageStr = message as string;
                postMessage({
                  type: "websocket:message",
                  data: {
                    payload: messageStr,
                  },
                });
              }
            },
          );

          reply({
            type: "reply",
          });
          break;
        }
        case "websocket:send": {
          console.debug("websocket:send", msg.data);

          const { payload } = msg.data;

          httpServer.receive_websocket_from_js(payload);
          break;
        }
        case "http:request": {
          console.debug("http:request", msg.data);

          const { request } = msg.data;

          const onResponse = (
            statusCode: number,
            _headers: PyProxy,
            _body: PyProxy,
          ) => {
            const headers = new Map<string, string>(_headers.toJs()); // Pyodide converts dict to LiteralMap, not Map, which can't be cloned and sent to the main thread. So we convert it to Map here. Ref: https://github.com/pyodide/pyodide/pull/4576
            const body = _body.toJs();
            console.debug({ statusCode, headers, body });

            reply({
              type: "http:response",
              data: {
                response: {
                  statusCode,
                  headers,
                  body,
                },
              },
            });
          };

          httpServer.receive_http_from_js(
            request.method,
            decodeURIComponent(request.path),
            request.headers,
            request.body,
            onResponse,
          );
          break;
        }
        case "file:write": {
          const { path, data: fileData, opts } = msg.data;

          if (
            moduleAutoLoad &&
            typeof fileData === "string" &&
            path.endsWith(".py")
          ) {
            // Auto-install must be dispatched before writing the file
            // because its promise should be set before saving the file triggers rerunning.
            console.debug(`Auto install the requirements in ${path}`);

            dispatchModuleAutoLoading(pyodide, postMessage, [fileData]);
          }

          console.debug(`Write a file "${path}"`);
          writeFileWithParents(pyodide, path, fileData, opts);
          reply({
            type: "reply",
          });
          break;
        }
        case "file:rename": {
          const { oldPath, newPath } = msg.data;

          console.debug(`Rename "${oldPath}" to ${newPath}`);
          renameWithParents(pyodide, oldPath, newPath);
          reply({
            type: "reply",
          });
          break;
        }
        case "file:unlink": {
          const { path } = msg.data;

          console.debug(`Remove "${path}`);
          pyodide.FS.unlink(path);
          reply({
            type: "reply",
          });
          break;
        }
        case "file:read": {
          const { path, opts } = msg.data;

          console.debug(`Read "${path}"`);
          const content = pyodide.FS.readFile(path, opts);
          reply({
            type: "reply:file:read",
            data: {
              content,
            },
          });
          break;
        }
        case "install": {
          const { requirements: unvalidatedRequirements } = msg.data;

          const micropip = pyodide.pyimport("micropip");

          const requirements = validateRequirements(unvalidatedRequirements); // Blocks the not allowed wheel URL schemes.
          console.debug("Install the requirements:", requirements);
          await micropip.install
            .callKwargs(requirements, { keep_going: true })
            .then(() => {
              console.debug("Successfully installed");
              reply({
                type: "reply",
              });
            });
        }
      }
    } catch (error) {
      console.error(error);

      if (!(error instanceof Error)) {
        throw error;
      }

      // The `error` object may contain non-serializable properties such as function (for example Pyodide.FS.ErrnoError which has a `.setErrno` function),
      // so it must be converted to a plain object before sending it to the main thread.
      // Otherwise, the following error will be thrown:
      // `Uncaught (in promise) DOMException: Failed to execute 'postMessage' on 'MessagePort': #<Object> could not be cloned.`
      // Also, the JSON.stringify() and JSON.parse() approach like https://stackoverflow.com/a/42376465/13103190
      // does not work for Error objects because the Error object is not enumerable.
      // So we use the following approach to clone the Error object.
      const cloneableError = new Error(error.message);
      cloneableError.name = error.name;
      cloneableError.stack = error.stack;

      reply({
        type: "reply",
        error: cloneableError,
      });
    }
  };

  postMessage({
    type: "event:start",
  });

  return onmessage;
}

async function handleCogniteMessage(
  pyodidePromise: Promise<Pyodide.PyodideInterface>,
  msg: InMessage,
) {
  if (msg.type === "newToken") {
    const token = msg.data.token;
    const project = msg.data.project;
    const baseUrl = msg.data.baseUrl;
    const fusionUrl = msg.data.fusionUrl;
    const organization = msg.data.organization;

    if (token && project && baseUrl) {
      const pyodide = await pyodidePromise;
      await pyodide.runPythonAsync(`
        import os
        os.environ["COGNITE_TOKEN"] = "${token}"
        os.environ["COGNITE_PROJECT"] = "${project}"
        os.environ["COGNITE_BASE_URL"] = "${baseUrl}"
        os.environ["COGNITE_FUSION_URL"] = "${fusionUrl}"
        os.environ["COGNITE_ORGANIZATION"] = "${organization}"
        # Set flag to tell the SDK that we are inside of a Fusion Notebook:
        os.environ["COGNITE_FUSION_NOTEBOOK"] = "1"
      `);

      tokenIsSet = true;
    }
  } else if (tokenIsSet && msg.type === LanguageServerEvents.autocomplete) {
    const pyodide = await pyodidePromise;
    handleAutoComplete(postMessage, msg, pyodide);
  } else if (tokenIsSet && msg.type === LanguageServerEvents.hover) {
    const pyodide = await pyodidePromise;
    handleHover(postMessage, msg, pyodide);
  }
}
