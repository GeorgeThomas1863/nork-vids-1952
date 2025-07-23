//GO BACK THROUGH AND UNDERSTAND HOW SHT WORKS

import axios from "axios";
import fs from "fs";

import CONFIG from "../config/config.js";

import { randomDelay } from "../config/util.js";

class DLHelper {
  constructor(dataObject) {
    this.dataObject = dataObject;
  }

  //-------------------

  //UTIL for multi thread vid download

  async getCompletedVidChunks() {
    const { downloadChunks, vidSizeBytes, tempPath } = this.dataObject;
    const { vidChunkSize } = CONFIG;

    // Make sure we have all required properties
    if (!tempPath || !downloadChunks) {
      console.log("Error: Missing required properties for getCompletedVidChunks");
      return [];
    }

    const completedChunkArray = [];

    for (let i = 0; i < downloadChunks; i++) {
      //save path for chunk
      const chunkSavePath = `${tempPath}chunk_${i + 1}.mp4`;

      if (fs.existsSync(chunkSavePath)) {
        const stats = fs.statSync(chunkSavePath);

        //MAKE SURE BELOW DOESNT DELETE FIRST / LAST CHUNK
        const expectedSize = i < downloadChunks - 1 ? vidChunkSize : vidSizeBytes - i * vidChunkSize;
        if (stats.size === expectedSize) {
          completedChunkArray.push(i);
        } else {
          fs.unlinkSync(chunkSavePath); // Remove partial chunks
        }
      }
    }

    return completedChunkArray;
  }

  async createVidQueue() {
    const { downloadChunks, vidSizeBytes, tempPath } = this.dataObject;
    const { vidChunkSize } = CONFIG;

    const pendingChunkArray = [];
    for (let i = 0; i < downloadChunks; i++) {
      //DEFINE CHUNK SAVE PATH HERE
      const chunkSavePath = `${tempPath}chunk_${i + 1}.mp4`;
      if (fs.existsSync(chunkSavePath)) continue;

      const start = i * vidChunkSize;
      const end = Math.min(start + vidChunkSize - 1, vidSizeBytes - 1);
      const pendingObj = {
        index: i,
        start: start,
        end: end,
        chunkSavePath: chunkSavePath,
      };
      pendingChunkArray.push(pendingObj);
    }
    return pendingChunkArray;
  }

  async processVidQueue() {
    const { completedChunkArray, pendingChunkArray, downloadChunks } = this.dataObject;
    const { vidConcurrent, vidRetries } = CONFIG;

    // Make sure we have all required properties
    if (!downloadChunks || !pendingChunkArray) {
      console.log("Error: Missing required properties for processVidQueue");
      return [];
    }

    // If completedChunkArray is undefined, initialize as empty array
    const downloadedChunkArray = completedChunkArray ? [...completedChunkArray] : [];
    let remainingChunkArray = [...pendingChunkArray];

    // Process chunks with retry attempts recursively
    for (let i = 0; i < vidRetries; i++) {
      const failedChunkArray = [];

      for (let j = 0; j < remainingChunkArray.length; j += vidConcurrent) {
        const batch = remainingChunkArray.slice(j, j + vidConcurrent);
        const promises = [];

        for (let k = 0; k < batch.length; k++) {
          const chunk = batch[k];
          const downloadObj = { ...this.dataObject };

          downloadObj.chunkIndex = chunk.index;
          downloadObj.start = chunk.start;
          downloadObj.end = chunk.end;
          downloadObj.chunkSavePath = chunk.chunkSavePath;

          const downloadModel = new DLHelper(downloadObj);
          const downloadPromise = downloadModel.downloadVidChunk();
          promises.push(downloadPromise);
        }

        const results = await Promise.allSettled(promises);

        //process results
        for (let m = 0; m < results.length; m++) {
          const resultItem = results[m];

          if (resultItem.status === "fulfilled" && resultItem.value) {
            downloadedChunkArray.push(resultItem.value.chunkIndex);
          } else {
            console.error(`Failed chunk ${batch[m].index}: ${resultItem.reason || "Unknown error"}`);
            failedChunkArray.push(batch[m]);
          }
        }

        // Show progress
        const progress = ((downloadedChunkArray.length / downloadChunks) * 100).toFixed(1);
        console.log(`Overall progress: ${progress}% (${downloadedChunkArray.length}/${downloadChunks} chunks)`);
      }

      //update remaining
      remainingChunkArray = failedChunkArray;

      if (remainingChunkArray.length > 0 && i < vidRetries - 1) {
        console.log(`Retry attempt ${i + 1}/${vidRetries}: ${remainingChunkArray.length} chunks remaining`);

        // Add exponential backoff between retry attempts (starting at 100ms)
        await new Promise((resolve) => setTimeout(resolve, 100 * Math.pow(2, i + 1)));
      }
    }

    return downloadedChunkArray?.length;
  }

  async downloadVidChunk() {
    const { url, chunkIndex, start, end, chunkSavePath } = this.dataObject;
    const { vidRetries } = CONFIG;

    // Make sure we have all required properties
    if (!url || chunkIndex === undefined || start === undefined || end === undefined) {
      console.log("Error: Missing required properties for downloadVidChunk");
      return null;
    }

    for (let retry = 0; retry < vidRetries; retry++) {
      try {
        const res = await axios({
          method: "get",
          url: url,
          responseType: "arraybuffer",
          timeout: 1 * 60 * 1000, //1 minute delay (needed)
          headers: { Range: `bytes=${start}-${end}` },
        });

        // Write chunk to save path
        // const tempFile = `${vidTempPath}.part${chunkIndex}`;
        fs.writeFileSync(chunkSavePath, Buffer.from(res.data));

        console.log(`Chunk ${chunkIndex} downloaded (bytes ${start}-${end})`);

        //obv put into obj
        const returnObj = {
          chunkIndex: chunkIndex,
          chunkSavePath: chunkSavePath,
          start: start,
          end: end,
        };

        return returnObj;
      } catch (e) {
        console.error(`Chunk ${chunkIndex} error: ${e.message}`);

        if (retry < vidRetries - 1) {
          const delay = await randomDelay(3);
          console.log("Retrying after " + delay + "ms");
          await new Promise((r) => setTimeout(r, delay));
        } else {
          return null;
        }
      }
    }
  }

  async mergeChunks() {
    const { vidSavePath, chunkSavePath, downloadChunks } = this.dataObject;

    console.log("Merging chunks...");
    const writeStream = fs.createWriteStream(vidSavePath);

    for (let i = 0; i < downloadChunks; i++) {
      const chunkData = fs.readFileSync(chunkSavePath);
      writeStream.write(chunkData);
      fs.unlinkSync(chunkSavePath); // Clean up temp file
    }

    writeStream.end();
    console.log("Merge complete");
  }

  async cleanupTempVidFiles() {
    const { downloadChunks, tempPath } = this.dataObject;

    for (let i = 0; i < downloadChunks; i++) {
      const chunkSavePath = `${tempPath}chunk_${i + 1}.mp4`;
      if (fs.existsSync(chunkSavePath)) {
        fs.unlinkSync(chunkSavePath);
      }
    }
  }
}

export default DLHelper;
