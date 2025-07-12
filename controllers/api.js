// import { parseAdminCommand, runScrapeCommand } from "../src/scrape-command.js";
import { runAdminCommand } from "../src/scrape-control.js";
import { scrapeState } from "../src/state.js";

export const apiRoute = async (req, res) => {
  const inputParams = req.body;

  console.log("INPUT PARAMS");
  console.log(inputParams);

  //updates the scrapeState
  const data = await runAdminCommand(inputParams);
  //return to displayer
  res.json(data);
  //runs the command sent
};
