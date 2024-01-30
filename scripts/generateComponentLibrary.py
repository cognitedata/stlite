# This code will convert the component library from this repo into a Fusion compatible JSON file that can be an app.

import os
app_path = os.path.join("packages", "sharing-editor", "public", "samples", "011_component_gallery")
pages_path = os.path.join(app_path, "pages")
requirements_path = os.path.join(app_path, "requirements.txt")
entrypoint_path = os.path.join(app_path, "streamlit_app.py")

# Read requirements
with open(requirements_path, "r") as f:
    print("Reading requirements ", entrypoint_path)
    requirements = f.read().splitlines()
    requirements = [r for r in requirements if r not in ['streamlit', 'numpy', 'matplotlib', 'requests', 'pandas']]

files = {}

with open(entrypoint_path, "r") as f:
    print("Reading entry point file ", entrypoint_path)
    entrypoint = f.read()
    files['main.py'] = {
        "content": entrypoint,
        "$case": "text"
    }

# Iterate all pages

for page in os.listdir(pages_path):
    page_path = os.path.join(pages_path, page)
    if not page.endswith(".py"):
        continue
    print("Reading page ", page_path)
    with open(page_path, "r") as f:
        content = f.read().splitlines()
        files[f'pages/{page}'] = {
            "content": content,
            "$case": "text"
        }

app = {
    "requirements": requirements,
    "entrypoint": "main.py",
    "files": files
}

with open('component_library_app.json', 'w') as f:
    import json
    json.dump(app, f, indent=2)
    print("Added component library app to component_library_app.json")
