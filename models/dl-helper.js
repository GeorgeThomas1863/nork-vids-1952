//GO BACK THROUGH AND UNDERSTAND HOW SHT WORKS

import axios from "axios";
import fs from "fs";
import fsPromises from "fs/promises";
import { exec } from "child_process";
import { promisify } from "util";

import CONFIG from "../config/config.js";
import { randomDelay } from "../config/util.js";

//some promises thing to run ffmpeg
const execPromise = promisify(exec);

class DLHelper {
  constructor(dataObject) {
    this.dataObject = dataObject;
  }

  //-------------------

  //UTIL for multi thread vid download

  async getCompletedVidChunks() {
    const { vidSavePath, downloadChunks } = this.dataObject;

    // Make sure we have all required properties
    if (!vidSavePath || !downloadChunks) {
      console.log("Error: Missing required properties for getCompletedVidChunks");
      return [];
    }

    //check chunks are complete vid items, add if they are
    const completedChunkArray = [];
    for (let i = 0; i < downloadChunks; i++) {
      const savePath = `${vidSavePath}chunk_${i + 1}.mp4`;

      if (!fs.existsSync(savePath)) continue;

      try {
        // Check if it's a valid video file using ffprobe
        const cmd = `ffprobe -v error -select_streams v:0 -show_entries stream=codec_type -of default=noprint_wrappers=1:nokey=1 "${savePath}"`;
        const { stdout, stderr } = await execPromise(cmd, { encoding: "utf8" });

        if (stdout.trim() !== "video") {
          await fsPromises.unlink(savePath);
          continue;
        }

        completedChunkArray.push(savePath);
      } catch (e) {
        // If ffprobe fails, the file is likely corrupted
        await fsPromises.unlink(savePath);
      }
    }
    return completedChunkArray;
  }

  async createVidQueue() {
    const { downloadChunks, vidSavePath, vidSeconds } = this.dataObject;
    const { chunkSeconds } = CONFIG; //default chunk length

    // Make sure we have all required properties
    if (!downloadChunks || !chunkSeconds) {
      console.log("Error: Missing required properties for createVidQueue");
      return [];
    }

    const pendingChunkArray = [];
    for (let i = 0; i < downloadChunks; i++) {
      //check if chunk is already saved
      const chunkPath = `${vidSavePath}chunk_${i + 1}.mp4`;
      if (fs.existsSync(chunkPath)) continue;

      const start = i * chunkSeconds;
      if (start > vidSeconds) break;

      const end = Math.min((i + 1) * chunkSeconds, vidSeconds);
      const chunkLength = end - start;
      const pendingObj = {
        index: i,
        start: start,
        // end: end,
        chunkLength: chunkLength,
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
          downloadObj.chunkLength = chunk.chunkLength;

          const downloadModel = new DLHelper(downloadObj);
          const downloadPromise = downloadModel.downloadVidChunkFfmpeg();
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

        // Add exponential backoff between retry attempts
        await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, i + 1)));
      }
    }

    return downloadedChunkArray?.length;
  }

  async downloadVidChunkFfmpeg() {
    const { url, vidSavePath, vidName, chunkIndex, start, chunkLength } = this.dataObject;
    const { vidRetries, tempPath } = CONFIG;

    // Make sure we have all required properties
    if (!url || !vidSavePath || !chunkIndex || !start || !chunkLength) {
      console.log("Error: Missing required properties for downloadVidChunk");
      console.log("RECEIVED: " + JSON.stringify(this.dataObject));
      return null;
    }

    if (chunkLength < 0) {
      console.log("Error: CHUNK LENGTH FUCKED");
      console.log("RECEIVED: " + JSON.stringify(this.dataObject));
      return null;
    }

    //define paths
    const chunkName = `chunk_${chunkIndex + 1}`;
    const chunkPath = `${vidSavePath}${chunkName}.mp4`;
    const chunkTempPath = `${tempPath}${chunkName}_temp.mp4`;

    for (let retry = 0; retry < vidRetries; retry++) {
      try {
        // Use FFmpeg to download a specific time segment as a complete video
        const ffmpegCmd = [
          "ffmpeg",
          "-analyzeduration",
          "10M",
          "-probesize",
          "10M",
          "-ss",
          start.toString(), // Start time
          "-i",
          `"${url}"`, // Input URL
          "-t",
          chunkLength.toString(), // Duration
          "-c",
          "copy", // Copy codecs (fast)
          "-avoid_negative_ts",
          "make_zero", // Handle timestamp issues
          "-movflags",
          "+faststart", // Optimize for streaming
          "-y", // Overwrite output
          `"${chunkTempPath}"`, // Output file
        ].join(" ");

        // Execute FFmpeg command
        await execPromise(ffmpegCmd, {
          stdio: ["ignore", "pipe", "pipe"], // Ignore stdin, pipe stdout/stderr
          encoding: "utf8",
          maxBuffer: 1024 * 1024 * 10, // 10MB buffer
        });

        // Verify the output file exists and is valid
        const checkChunk = await this.checkChunkData(chunkTempPath);

        //if chunk fucked delete file and throw error
        if (!checkChunk) {
          await fsPromises.unlink(chunkTempPath);
          throw new Error("Output file is FUCKED / empty or doesn't exist");
        }

        // otherwise move temp file to final location
        await fsPromises.rename(chunkTempPath, chunkPath);
        console.log(`Chunk ${chunkIndex} downloaded successfully`);

        const returnObj = {
          chunkIndex: chunkIndex,
          start: start,
          chunkLength: chunkLength,
        };

        return returnObj;
      } catch (e) {
        console.error(`Chunk ${chunkIndex} error:`, e);
        console.error("FFmpeg command was:", ffmpegCmd);

        // If it's an exec error, log stderr
        if (e.stderr) {
          console.error("FFmpeg stderr:", e.stderr);
        }

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

  async checkChunkData(chunkPath) {
    if (!fs.existsSync(chunkPath)) return null;

    const stats = await fsPromises.stat(chunkPath);
    if (stats.size === 0) return null;

    //otherwise return true
    return true;
  }
}

export default DLHelper;
