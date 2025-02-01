import { mount } from "./mount";

export interface AppData {
  entrypoint?: string;
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

const listenForApp = () => {
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
          mountedApp = mount(
            app,
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
                mountedApp.writeFile(
                  fileName,
                  app.files[fileName].content.text
                );
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
      },
      "*"
    );
  }
};

export { listenForApp };
