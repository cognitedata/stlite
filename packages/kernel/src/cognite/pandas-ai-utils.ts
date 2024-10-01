import type Pyodide from "pyodide";
import type { PyProxy } from "pyodide/ffi";
import { InPandasAiExecuteCode } from "../types";

export const PandasAiExecuteRequest = "pandas-ai:execute";

/**
 * Imports the necessary python packages to enable language server features
 */
export const importPandasAILibraries = async (
  pyodide: Pyodide.PyodideInterface,
  micropip: PyProxy,
) => {
  try {
    await micropip.install.callKwargs(["cognite-ai"], {
      keep_going: true,
    });
    await pyodide.runPythonAsync(`import cognite.ai`);
    console.debug("Importing cognite.ai");
  } catch (err) {
    console.error("Error while importing cognite.ai", err);
  }
};

export const run_pandas_code = async (
  msg: InPandasAiExecuteCode,
  pyodide: Pyodide.PyodideInterface,
) => {
  try {
    // Indentation is very important in python, don't change this!
    const result = await pyodide.runPythonAsync(`${msg.data.code}`);

    console.debug("Pandas code executed", result);
    if (!result) {
      return { result: [] };
    }

    return { result: JSON.parse(result) };
  } catch (err) {
    console.error(err);
    return { result: [] };
  }
};

export const handlePandasAiCode = async (
  postMessage: (message: any) => void,
  msg: InPandasAiExecuteCode,
  pyodide: Pyodide.PyodideInterface,
) => {
  const response = {
    type: "pandas-ai:execute",
    data: {
      result: [],
    },
  } as any;

  try {
    response.data = await run_pandas_code(msg, pyodide);
  } catch (err) {
    console.error(err);
    // TODO: send the errors to mixpanel or sentry
  } finally {
    /**
     * This is happening inside a function in a web worker
     * we need to notify the worker that we processed the request
     * so that the Kernel can send the message to fusion
     */
    postMessage(response);
    // postMessageToStreamLitWorker(ctx, autoCompleteResponse);
  }
};
