const fs = require("fs-extra");
const glob = require("glob");

const ROOT_ALLURE_RESULTS = "./allure-results"; // Target directory in the root

fs.ensureDirSync(ROOT_ALLURE_RESULTS);

const directories = glob.sync("packages/**/allure-results");

directories.forEach((dir) => {
  const files = fs.readdirSync(dir);
  files.forEach((file) => {
    const sourcePath = `${dir}/${file}`;
    const targetPath = `${ROOT_ALLURE_RESULTS}/${file}`;
    fs.copyFileSync(sourcePath, targetPath);
  });
});

console.log("All allure-results directories merged successfully!");
