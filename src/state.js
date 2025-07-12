export const scrapeState = {
  scrapeId: null,
  scrapeActive: false,
  schedulerActive: false,

  textStr: null,
  runScrape: false,

  scrapeStartTime: null,
  scrapeEndTime: null,
  scrapeSeconds: 0,
  scrapeMinutes: 0,

  scrapeCommand: null,
  commandReq: null, //all params sent to command
  finished: false,
};
