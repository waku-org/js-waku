const fs = require("fs-extra");
const glob = require("glob");

const ROOT_ALLURE_RESULTS = "./allure-results"; // Target directory in the root

// Ensure the target directory exists
fs.ensureDirSync(ROOT_ALLURE_RESULTS);

// Get all allure-results directories in packages
const directories = glob.sync("packages/**/allure-results");

directories.forEach((dir) => {
  const files = fs.readdirSync(dir);
  files.forEach((file) => {
    const sourcePath = `${dir}/${file}`;
    const targetPath = `${ROOT_ALLURE_RESULTS}/${file}`;

    // If the same file exists in the root directory, it is overwritten.
    // Depending on your needs, you can adjust this behavior.
    fs.copyFileSync(sourcePath, targetPath);
  });
});

console.log("All allure-results directories merged successfully!");
