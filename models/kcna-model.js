import axios from "axios";
import fs from "fs";
import fsPromises from "fs/promises";
import DLHelper from "./dl-helper.js";
import { randomDelay } from "../src/util.js";

class KCNA {
  constructor(dataObject) {
    this.dataObject = dataObject;
  }

  //confirm try catch works
  async getHTML() {
    const inputURL = this.dataObject.url;
    if (!inputURL) return null;

    try {
      const res = await axios({
        method: "get",
        url: inputURL,
        timeout: 60000,
        responseType: "text",
      });

      return res.data;
    } catch (e) {
      //AXIOS PRODUCES OWN CUSTOM ERROR
      console.log("GET HTML ERROR");
      console.log("ERROR, for " + inputURL);
      console.log(e);
      return null;
    }
  }

  async getMediaHeaders() {
    const inputURL = this.dataObject.url;
    if (!inputURL) return null;

    //random between up to 200 bytes
    const randomBytes = Math.floor(Math.random() * 200);
    const byteText = "bytes=0-" + randomBytes;
    console.log("BYTES:", randomBytes);

    try {
      const res = await axios({
        method: "get",
        url: inputURL,
        headers: { Range: byteText },
        timeout: 30000,
      });

      const headers = res.headers;
      console.log("GOT FUCKING HEADERS");

      return headers;
    } catch (e) {
      console.log("HEADER ERROR for " + inputURL + "; | RESPONSE: ");
      console.log(e.code);
      //on fail try stream
      const retryModel = new KCNA(this.dataObject);
      const retryData = await retryModel.retryStream();
      return retryData;
    }
  }

  //HEADER RETRY 2
  async retryStream() {
    const inputURL = this.dataObject.url;
    if (!inputURL) return null;

    try {
      // await randomDelay(3);
      const res = await axios({
        method: "get",
        url: inputURL,
        responseType: "stream",
        timeout: 30000,
      });

      const headers = res.headers;
      console.log("GOT FUCKING HEADERS", headers);

      // Immediately abort the stream to prevent downloading the entire file
      res.data.destroy();

      return headers;
    } catch (e) {
      //if still fucked, check if pic and if so try full thing
      if (inputURL.slice(-4) === ".jpg") {
        const finalTryModel = new KCNA(this.dataObject);
        const res = await finalTryModel.retryFullReq();
        return res;
      }

      //otherwise give up
      return null;
    }
  }

  //HEADER RETRY 3
  async retryFullReq() {
    const inputURL = this.dataObject.url;
    if (!inputURL) return null;

    try {
      await randomDelay(3);
      const res = await axios({
        method: "get",
        url: inputURL,
        timeout: 15000, //only wait 15 sec
      });

      const headers = res.headers;

      return headers;
    } catch (e) {
      console.log("TRIED FULL REQ, STILL FUCKED");
      // console.log(e);
      return null;
    }
  }

  //-------------------------

  async downloadPicReq() {
    const { url, savePath, picId } = this.dataObject;

    //obj for tracking
    const picObj = { ...this.dataObject };
    picObj.downloadedSize = 0;

    try {
      const res = await axios({
        method: "get",
        url: url,
        timeout: 120000, //2 minutes
        responseType: "stream",
      });
      if (!res || !res.data) {
        const error = new Error("FETCH FUCKED");
        error.url = url;
        error.fucntion = "GET PIC REQ AXIOS";
        throw error;
      }

      const writer = fs.createWriteStream(savePath);
      const stream = res.data.pipe(writer);
      let downloadedSize = 0;

      res.data.on("data", (chunk) => {
        // Log progress in KB every 100KB
        downloadedSize += chunk.length;
        if (downloadedSize % 102400 < chunk.length) {
          const downloadedKB = Math.floor(downloadedSize / 1024);
          console.log(`Downloaded: ${downloadedKB}KB`);
        }
      });
      await new Promise((resolve, reject) => {
        stream.on("finish", resolve);
        stream.on("error", reject);
      });

      console.log(`DOWNLOAD COMPLETE: ${picId}.jpg | FINAL SIZE: ${Math.round(downloadedSize / 1024)}KB`);

      picObj.downloadedSize = downloadedSize;
      return picObj;
    } catch (e) {
      console.log(url + "; " + e.message + "; F BREAK: " + e.function);
      return null;
    }
  }

  //complex multi thread download
  async downloadVidMultiThread() {
    //get obj data
    const { downloadChunks, vidSavePath } = this.dataObject;
    const vidObj = { ...this.dataObject };

    console.log("DOWNLOADING VID MULTI THREAD INPUT");
    console.log(vidObj);

    try {
      //find shit already downloaded
      const completedModel = new DLHelper(vidObj);
      const completedChunkArray = await completedModel.getCompletedVidChunks();
      vidObj.completedChunkArray = completedChunkArray;

      if (completedChunkArray.length > 0) {
        console.log("Resuming Chunk " + completedChunkArray.length + " of " + downloadChunks + " total chunks");
      }

      //create vid download queue
      const pendingModel = new DLHelper(vidObj);
      const pendingChunkArray = await pendingModel.createVidQueue();
      vidObj.pendingChunkArray = pendingChunkArray;

      const processModel = new DLHelper(vidObj);
      const chunksProcessed = await processModel.processVidQueue();
      vidObj.chunksProcessed = chunksProcessed;

      const mergeModel = new DLHelper(vidObj);
      await mergeModel.mergeChunks();

      //CHECK FUCKING VID HERE
      const vidExists = await fsPromises.access(vidSavePath, constants.F_OK);
      console.log("DOES THE FUCKING VID EXIST");
      console.log(vidExists);
    

      return vidObj;
    } catch (e) {
      console.log(e.url + "; " + e.message + "; F BREAK: " + e.function);
      //return null on failure
      return null;
    }
  }
}

export default KCNA;
