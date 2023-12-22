import React from "react";
import ReactDOM from "react-dom";
import StreamlitApp from "./StreamlitApp";
import { StliteKernel } from "@stlite/kernel";
import { getParentUrl } from "./url";
import {
  canonicalizeMountOptions,
  MountOptions,
  SimplifiedStliteKernelOptions,
} from "./options";
import {
  ToastContainer,
  makeToastKernelCallbacks,
  StliteKernelWithToast,
} from "@stlite/common-react";
import "react-toastify/dist/ReactToastify.css";
import "@stlite/common-react/src/toastify-components/toastify.css";

/**
 * If `PUBLIC_PATH` which is exported as a global variable `__webpack_public_path__` (https://webpack.js.org/guides/public-path/#on-the-fly)
 * is set as a relative URL, resolve and override it based on the URL of this script itself,
 * which will be transpiled into `stlite.js` at the root of the output directory.
 */
let wheelBaseUrl: string | undefined = undefined;
if (
  typeof __webpack_public_path__ === "string" &&
  (__webpack_public_path__ === "." || __webpack_public_path__.startsWith("./"))
) {
  if (document.currentScript && "src" in document.currentScript) {
    const selfScriptUrl = document.currentScript.src;
    const selfScriptBaseUrl = getParentUrl(selfScriptUrl);

    __webpack_public_path__ = selfScriptBaseUrl; // For webpack dynamic imports
    wheelBaseUrl = selfScriptBaseUrl;
  }
}

export function mount(
  options: MountOptions,
  container: HTMLElement = document.body
) {
  const kernel = new StliteKernel({
    ...canonicalizeMountOptions(options),
    wheelBaseUrl,
    ...makeToastKernelCallbacks(),
  });
  ReactDOM.render(
    <React.StrictMode>
      <StreamlitApp kernel={kernel} />
      <ToastContainer />
    </React.StrictMode>,
    container
  );

  const kernelWithToast = new StliteKernelWithToast(kernel);
  let currentKernel: StliteKernel | StliteKernelWithToast = kernelWithToast;

  return {
    unmount: () => {
      kernel.dispose();
      ReactDOM.unmountComponentAtNode(container);
    },
    install: (requirements: string[]) => {
      return currentKernel.install(requirements);
    },
    writeFile: (
      path: string,
      data: string | ArrayBufferView,
      opts?: Record<string, any>
    ) => {
      return currentKernel.writeFile(path, data, opts);
    },
    renameFile: (oldPath: string, newPath: string) => {
      return currentKernel.renameFile(oldPath, newPath);
    },
    unlink: (path: string) => {
      return currentKernel.unlink(path);
    },
    enableToast: (): void => {
      currentKernel = kernelWithToast;
    },
    disableToast: (): void => {
      currentKernel = kernel;
    },
  };
}

export interface AppData {
  entrypoint?: string;
  theme?: "Light" | "Dark";
  files: {
    [key: string]: {
      content?:
        | {
            $case: "text";
            text: string;
          }
        | {
            $case: "data";
            data: Uint8Array;
          };
    };
  };
  requirements: string[];
}

let prevApp: AppData | null = null;
let mountedApp: any = null;

window.addEventListener(
  "message",
  async (event) => {
    if (typeof event.data === "object" && "code" in event.data) {
      if (!mountedApp) {
        mountedApp = mount(
          {
            entrypoint: "streamlit_app.py",
            files: {},
            requirements: ["matplotlib"],
          },
          document.getElementById("root") as HTMLElement
        );
      }

      mountedApp.writeFile("streamlit_app.py", event.data.code);
    } else if (typeof event.data === "object" && "app" in event.data) {
      const app = event.data.app;
      if (!mountedApp) {
        const restructuredFiles: { [key: string]: string } = {};

        // File format is not exactly identical
        for (const fileName in app.files) {
          restructuredFiles[fileName] = app.files[fileName].content.text;
        }

        app.files = restructuredFiles;

        // Might not have an entrypoint
        if (!app.entrypoint) {
          // Just guess that the first .py file is the entrypoint
          // TODO: fix this to be more robust
          for (const fileName in app.files) {
            if (fileName.endsWith(".py")) {
              app.entrypoint = fileName;
              break;
            }
          }
        }

        let mountableApp: SimplifiedStliteKernelOptions = app;
        const theme = app.theme || "Light";
        mountableApp.streamlitConfig = {
          "theme.base": theme.toLowerCase(),
        };

        mountedApp = mount(
          mountableApp,
          document.getElementById("root") as HTMLElement
        );
        prevApp = app;
      } else {
        if (prevApp) {
          // Remove any deleted files
          Object.keys(prevApp.files).forEach((prevFileName) => {
            if (!(prevFileName in app.files)) {
              mountedApp.unlink(prevFileName);
            }
          });

          // Write any new or changed files
          for (const fileName in app.files) {
            if (
              !(fileName in prevApp.files) ||
              app.files[fileName].content !== prevApp.files[fileName].content
            ) {
              mountedApp.writeFile(fileName, app.files[fileName].content.text);
            }
          }
        }

        prevApp = event.data.app;
      }
    }
  },
  false
);

// communicate if in iframe to parent (top)
if (window.top) {
  window.top.postMessage(
    {
      streamlitstatus: "ready",
      entrypoint: "streamlit_app.py",
      files: {
        "streamlit_app.py": `import streamlit as st
import matplotlib.pyplot as plt
import numpy as np
import os

st.markdown("Files in \`.\`:")
st.write(os.listdir("."))

st.markdown("\`./foo/foo.txt\`:")
with open("./foo/foo.txt") as f:
    st.write(f.read())

st.markdown("\`./bar.txt\`:")
with open("./bar.txt") as f:
    st.write(f.read())

size = st.slider("Sample size", 100, 1000)

arr = np.random.normal(1, 1, size=size)
fig, ax = plt.subplots()
ax.hist(arr, bins=20)

st.pyplot(fig)

st.latex(r'''
     a + ar + a r^2 + a r^3 + \\cdots + a r^{n-1} =
     \\sum_{k=0}^{n-1} ar^k =
     a \\left(\\frac{1-r^{n}}{1-r}\\right)
     ''')

import pandas as pd
import numpy as np

df = pd.DataFrame(
     np.random.randn(1000, 2) / [50, 50] + [37.76, -122.4],
     columns=['lat', 'lon'])

st.map(df)
    `,
        "bar.txt": {
          url: "/test-files/bar.txt",
        },
      },
      archives: [
        {
          url: "/test-files/foo.zip",
          format: "zip",
        },
      ],
      requirements: ["matplotlib"],
    },
    "*"
  );
}
