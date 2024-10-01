// @vitest-environment node

import { loadPyodide, PyodideInterface } from "pyodide";
import { describe, expect, it, vi, beforeAll } from "vitest";
import {
  handlePandasAiCode,
  importPandasAILibraries,
  run_pandas_code,
} from "./pandas-ai-utils";

const PANDAS_WHEEL = new URL(
  "../../py/pandasai/cognite_ai-0.4.7-py3-none-any.whl",
  import.meta.url,
).href;
const REGEX_WHEEL = new URL(
  "../../py/pandasai/regex-2023.8.8-py3-none-any.whl",
  import.meta.url,
).href;

describe("PandasAI Utils test", () => {
  let pyodide: PyodideInterface;

  /**
   * Import only the necesarry dependencies so we can run jedi
   * and test the language server
   */
  beforeAll(async () => {
    const pandasWheelUrl = PANDAS_WHEEL as unknown as string;
    const wheels = {
      regex: REGEX_WHEEL as unknown as string,
      pandasai: pandasWheelUrl,
      "cognite.ai": pandasWheelUrl,
      "cognite-ai": pandasWheelUrl,
      cognite_ai: pandasWheelUrl,
    };

    pyodide = await loadPyodide({
      // indexURL: "https://cdn.jsdelivr.net/npm/pyodide@0.24.1/pyodide.js",
      indexURL: "../../node_modules/pyodide", // Installed at the Yarn workspace root
      stdout: console.log,
      stderr: console.error,
      checkAPIVersion: false,
    });

    await pyodide.loadPackage("micropip");
    const micropip = pyodide.pyimport("micropip");
    console.log("Installing the wheels:", wheels);
    const reqirements = [
      "pyodide-http==0.2.1",
      "cognite-sdk==7.51.1",
      "pandas",
    ];

    await micropip.install.callKwargs(
      [
        wheels.regex,
        wheels.pandasai,
        wheels["cognite.ai"],
        wheels["cognite-ai"],
        wheels.cognite_ai,
        ...reqirements,
      ],
      { keep_going: true },
    );

    // The following code is necessary to avoid errors like  `NameError: name '_imp' is not defined`
    // at importing installed packages.
    await pyodide.runPythonAsync(`
    import importlib
    importlib.invalidate_caches()
    `);

    console.log("Importing Language Server");
    await importPandasAILibraries(pyodide, micropip);
  });

  describe("Test CodeExecution", () => {
    it("should return suggestions", async () => {
      const code = `from cognite.client import CogniteClient, ClientConfig
from cognite.ai import load_pandasai
from cognite.client.credentials import Token

config = {"token": "Bearer ..."}
credentials = config

clientConfig = ClientConfig(base_url="https://api.cognitedata.com", project="lervik-industries", client_name="cog-demo",credentials=credentials)
client = CogniteClient(config=clientConfig)
SmartDataframe, SmartDatalake = await load_pandasai()

def test():
    df = SmartDatalake({
        "country": [
            "United States", "United Kingdom", "France", "Germany", "Italy", "Spain", "Canada", "Australia", "Japan", "China"],
        "gdp": [
            19294482071552, 2891615567872, 2411255037952, 3435817336832, 1745433788416, 1181205135360, 1607402389504, 1490967855104, 4380756541440, 14631844184064
        ],
    })

    return df.to_json();

test()
`;
      const autocompleteResults = await run_pandas_code(
        {
          type: "pandas-ai:execute",
          data: { code: code, responseType: "json", requirements: [] },
        },
        pyodide,
      );

      expect(autocompleteResults.result).toEqual({});
    });
  });
});
