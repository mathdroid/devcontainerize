#!/usr/bin/env node

import axios from "axios";
import { exec } from "child_process";
import fs from "fs";
import path from "path";
import readline from "readline";

const GITHUB_BASE_URL =
  "https://raw.githubusercontent.com/devcontainers/images/main/src";

const GITHUB_API_URL =
  "https://api.github.com/repos/devcontainers/images/contents/src";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function main() {
  try {
    const args = process.argv.slice(2);
    const autoGitignore = args.includes("--gitignore");

    console.log("Detecting project type...");
    let projectType = detectProjectType();

    if (projectType === "universal") {
      projectType = await promptUserForProjectType();
    }

    console.log(`Using project type: ${projectType}`);

    console.log("Creating devcontainer files...");
    await createDevContainer(projectType);

    console.log("Devcontainer files created successfully!");

    console.log("Checking for Git repository...");
    const isGitRepo = await runCommand(
      "git rev-parse --is-inside-work-tree"
    ).catch(() => "false");

    if (isGitRepo === "true") {
      if (autoGitignore) {
        console.log(
          "Git repository detected. Adding .devcontainer to .gitignore..."
        );
        await addToGitignore();
      } else {
        const shouldAddToGitignore = await promptYesNo(
          "Git repository detected. Do you want to add .devcontainer to .gitignore?"
        );
        if (shouldAddToGitignore) {
          await addToGitignore();
        }
      }
    } else {
      console.log("No Git repository detected. Skipping .gitignore update.");
    }

    console.log(
      "\nSetup complete! You can now use this project with Visual Studio Code Remote - Containers."
    );
    console.log(
      'To get started, install the "Remote - Containers" extension in VS Code and reopen this project in a container.'
    );
  } catch (error) {
    console.error("An error occurred:", error);
  } finally {
    rl.close();
  }
}

async function createDevContainer(projectType: string) {
  const devContainerDir = path.join(process.cwd(), ".devcontainer");
  fs.mkdirSync(devContainerDir, { recursive: true });

  const files = ["Dockerfile", "devcontainer.json"];
  for (const file of files) {
    console.log(`Fetching ${file}...`);
    const content = await fetchFileContent(projectType, file);
    fs.writeFileSync(path.join(devContainerDir, file), content);
    console.log(`${file} created successfully.`);
  }
}

function detectProjectType(): string {
  // Python: Detected by presence of requirements.txt (pip dependencies) or setup.py (package setup)
  if (fs.existsSync("requirements.txt") || fs.existsSync("setup.py"))
    return "python";

  // Node.js (JavaScript or TypeScript): Detected by presence of package.json
  if (fs.existsSync("package.json")) {
    const packageJson = JSON.parse(fs.readFileSync("package.json", "utf-8"));
    // TypeScript: Detected if typescript is listed in devDependencies
    if (packageJson.devDependencies?.typescript) return "typescript-node";
    // JavaScript: If package.json exists but typescript isn't in devDependencies
    return "javascript-node";
  }

  // Ruby: Detected by presence of Gemfile (Ruby dependencies)
  if (fs.existsSync("Gemfile")) return "ruby";

  // Rust: Detected by presence of Cargo.toml (Rust package manager manifest)
  if (fs.existsSync("Cargo.toml")) return "rust";

  // Java: Detected by presence of pom.xml (Maven) or build.gradle (Gradle)
  if (fs.existsSync("pom.xml") || fs.existsSync("build.gradle")) {
    // Check for specific Java version (Java 8)
    const files = fs.readdirSync(".");
    const javaVersionFile = files.find((file) =>
      file.startsWith("system.properties")
    );
    if (javaVersionFile) {
      const content = fs.readFileSync(javaVersionFile, "utf-8");
      if (content.includes("java.runtime.version=1.8")) return "java-8";
    }
    // Default to general Java if no specific version is detected
    return "java";
  }

  // Go: Detected by presence of go.mod (Go module definition)
  if (fs.existsSync("go.mod")) return "go";

  // PHP: Detected by presence of composer.json (PHP dependency manager)
  if (fs.existsSync("composer.json")) return "php";

  // Anaconda: Detected by presence of environment.yml (Anaconda environment file)
  if (fs.existsSync("environment.yml")) return "anaconda";

  // Miniconda: Detected by presence of conda-env.yml (Miniconda environment file)
  if (fs.existsSync("conda-env.yml")) return "miniconda";

  // C++: Detected by presence of CMakeLists.txt (CMake config) or Makefile
  if (fs.existsSync("CMakeLists.txt") || fs.existsSync("Makefile"))
    return "cpp";

  // .NET: Detected by presence of project files for C#, F#, or Visual Basic
  if (
    fs.existsSync(".csproj") ||
    fs.existsSync(".fsproj") ||
    fs.existsSync(".vbproj")
  )
    return "dotnet";

  // Jekyll: Detected by presence of _config.yml (Jekyll configuration file)
  if (fs.existsSync("_config.yml")) return "jekyll";

  // If no specific project type is detected, return "universal"
  return "universal";
}

async function getProjectTypes(): Promise<string[]> {
  try {
    const response = await axios.get(GITHUB_API_URL);
    return response.data
      .filter((item: any) => item.type === "dir")
      .map((item: any) => item.name);
  } catch (error) {
    console.error("Error fetching project types from GitHub:", error);
    return [
      "anaconda",
      "base-alpine",
      "base-debian",
      "base-ubuntu",
      "cpp",
      "dotnet",
      "go",
      "java",
      "javascript-node",
      "jekyll",
      "miniconda",
      "php",
      "python",
      "ruby",
      "rust",
      "typescript-node",
      "universal",
    ];
  }
}

async function promptUserForProjectType(): Promise<string> {
  const projectTypes = await getProjectTypes();

  return new Promise((resolve) => {
    console.log("Project type could not be automatically determined.");
    console.log("Please select a project type from the following options:");
    projectTypes.forEach((type, index) => {
      console.log(`${index + 1}. ${type}`);
    });

    rl.question("Enter the number of your choice: ", (answer) => {
      const choice = parseInt(answer);
      if (choice > 0 && choice <= projectTypes.length) {
        resolve(projectTypes[choice - 1]);
      } else {
        console.log("Invalid choice. Defaulting to universal.");
        resolve("universal");
      }
    });
  });
}

async function fetchFileContent(
  projectType: string,
  fileName: string
): Promise<string> {
  const url = `${GITHUB_BASE_URL}/${projectType}/.devcontainer/${fileName}`;
  try {
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    console.error(
      `Error fetching ${fileName} for ${projectType}. Falling back to universal.`
    );
    return fetchFileContent("universal", fileName);
  }
}

function runCommand(command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        resolve(stdout.trim());
      }
    });
  });
}

async function addToGitignore() {
  const gitignorePath = path.join(process.cwd(), ".gitignore");
  const content = fs.existsSync(gitignorePath)
    ? fs.readFileSync(gitignorePath, "utf-8")
    : "";

  if (!content.includes(".devcontainer")) {
    fs.appendFileSync(gitignorePath, "\n.devcontainer\n");
    console.log(".devcontainer added to .gitignore");
  } else {
    console.log(".devcontainer already in .gitignore");
  }
}

function promptYesNo(question: string): Promise<boolean> {
  return new Promise((resolve) => {
    rl.question(`${question} (y/n): `, (answer) => {
      resolve(answer.toLowerCase().startsWith("y"));
    });
  });
}

main().catch(console.error);
