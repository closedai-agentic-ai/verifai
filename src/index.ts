import { Lifecycle } from "./lifecycle";
import { config } from "dotenv";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";

config();

const testcase = `
App: com.qazi9amaan.rntodoapp
Test: Task Creation and Counter Validation
1. Verify header shows "asdhakdhskjhadsk"
2. Count current number of todo items
4. Tap on the add task input field
8. Type "New test task" and tap the add button
10. Press on the newly created task to complete it
11. Check if the task is completed
12. Count the number of completed tasks and verify it is 1
12. Clear the task list via the clear button
13. Verify that the task list is empty
`;

const main = async () => {
  const sessionId = uuidv4();

  // Initialize the lifecycle
  const lifecycle = new Lifecycle();
  await lifecycle.initialize({ sessionId });

  // Plan and execute the test
  const steps = await lifecycle.planTest(testcase);
  const results = await lifecycle.executePlannedSteps(steps);

  const report = results
    .map(
      (result) =>
        `[${result.status.toUpperCase()}] ${result.step} - ${result.message}`
    )
    .join("\n");
  fs.writeFileSync(`${sessionId}.txt`, report);

  console.log(`Report saved to ${sessionId}.txt`);

  process.exit(1);
};

main();
