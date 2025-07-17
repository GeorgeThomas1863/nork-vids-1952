import fs from "fs";
import FormData from "form-data";

import CONFIG from "../config/config.js";
import dbModel from "../models/db-model.js";
import { scrapeState } from "./state.js";
import { tgPostPicReq, tgEditMessageCaption, tgPostVidReq } from "./tg-api.js";

export const uploadNewVids = async () => {
  const { kcnaWatchDownloaded, kcnaWatchUploaded } = CONFIG;
  if (!scrapeState.scrapeActive) return null;

  const newVidParams = {
    collection1: kcnaWatchDownloaded,
    collection2: kcnaWatchUploaded,
  };

  const newVidModel = new dbModel(newVidParams, "");
  const newVidArray = await newVidModel.findNewURLs();
  if (!newVidArray || !newVidArray.length) return null;

  const vidUploadData = await uploadVidArray(newVidArray);

  return vidUploadData;
};

export const uploadVidArray = async (inputArray) => {
  if (!inputArray || !inputArray.length) return null;

  const uploadDataArray = [];
  // for (let i = 0; i < inputArray.length; i++) {
  for (let i = 0; i < 1; i++) {
    if (!scrapeState.scrapeActive) return null;
    try {
      // console.log("UPLOAD VID ARRAY ITEM");
      // console.log(inputArray[i]);
      // console.log("--------------------------------");
      const vidDataObj = await uploadVidFS(inputArray[i]);
      if (!vidDataObj) continue;

      uploadDataArray.push(vidDataObj);
    } catch (e) {
      console.log(`\nERROR! ${e.message} | FUNCTION: ${e.function} \n\n --------------------------------`);
      console.log(`\nARTICLE HTML: ${e.content} \n\n --------------------------------\n`);
    }
  }

  return uploadDataArray;
};

//uploads thumbnail and vid SEPARATELY (might want to change)
export const uploadVidFS = async (inputObj) => {
  if (!inputObj) return null;
  const { thumbnailSavePath, vidSavePath, date, itemId, vidData } = inputObj;
  const { vidSizeBytes, vidSizeMB } = vidData;
  const { uploadChunkSize, tgUploadId } = CONFIG;

  // console.log("UPLOAD CHUNK SIZE");
  // console.log(uploadChunkSize);
  // console.log("--------------------------------");

  const uploadChunks = Math.ceil(vidSizeBytes / uploadChunkSize);

  // console.log("UPLOAD CHUNKS");
  // console.log(uploadChunks);
  // console.log(vidSizeMB + "MB");
  // console.log("--------------------------------");

  //check if vid downloaded
  // if (!fs.existsSync(thumbnailSavePath) || !fs.existsSync(vidSavePath)) {
  if (!fs.existsSync(vidSavePath)) {
    const error = new Error("VidNOT downloaded");
    error.function = "uploadVidFS";
    error.content = inputObj;
    throw error;
  }

  // //upload vid
  const vidParams = {
    thumbnailPath: thumbnailSavePath,
    uploadChunkSize: uploadChunkSize,
    vidSizeBytes: vidSizeBytes,
    uploadChunks: uploadChunks,
    vidId: itemId,
    savePath: vidSavePath,
    tgUploadId: tgUploadId,
  };

  const uploadChunkData = await uploadVidChunk(vidParams);

  // console.log("VID PARAMS");
  // console.log(vidParams);
  // console.log("--------------------------------");

  // console.log("VID UPLOAD DATA");s
  // console.log(vidUploadData);
  // console.log("--------------------------------");

  // if (!vidUploadData) return null;
};

export const uploadVidChunk = async (inputObj) => {
  if (!inputObj) return null;
  const { thumbnailPath, uploadChunkSize, uploadChunks, vidId, savePath, dateNormal, vidSizeBytes, tgUploadId } = inputObj;

  const chunkParams = { ...inputObj };

  // console.log("upload VIDFS CHUNK SIZE");
  // console.log(uploadChunkSize);
  // console.log("--------------------------------");

  const chunkDataArray = [];
  for (let i = 0; i < uploadChunks; i++) {
    if (!scrapeState.scrapeActive) return null;
    try {
      //define chunk start end
      chunkParams.chunkStart = i * uploadChunkSize;
      chunkParams.chunkEnd = Math.min(vidSizeBytes, chunkParams.chunkStart + uploadChunkSize);
      chunkParams.chunkLength = chunkParams.chunkEnd - chunkParams.chunkStart;
      chunkParams.chunkNumber = i + 1; //THIS WILL BREAK THINGS

      console.log("++++++++++++++++++++++++");
      console.log(`NEW CHUNK! CHUNK START: ${chunkParams.chunkStart} | CHUNK END: ${chunkParams.chunkEnd} | CHUNK NUMBER: ${chunkParams.chunkNumber}`);

      console.log("CHUNK PARAMS");
      console.log(chunkParams);

      const chunkForm = await buildChunkForm(chunkParams);

      // console.log("CHUNK FORM");
      // console.log(chunkForm);
      // console.log("--------------------------------");

      const chunkPostData = await tgPostVidReq({ form: chunkForm });
      if (!chunkPostData) continue;

      chunkDataArray.push(chunkPostData);
    } catch (e) {
      console.log(`\nERROR! ${e.message} | FUNCTION: ${e.function} \n\n --------------------------------`);
      console.log(`\nARTICLE HTML: ${e.content} \n\n --------------------------------\n`);
    }
  }

  return chunkDataArray;
};

export const buildChunkForm = async (inputObj) => {
  const { savePath, tgUploadId, thumbnailPath, chunkStart, chunkEnd, chunkLength, chunkNumber, uploadChunks } = inputObj;

  const readStream = fs.createReadStream(savePath, { start: +chunkStart, end: +chunkEnd - 1 });

  console.log("READ STREAM");
  console.log(readStream);
  console.log("--------------------------------");

  // Create form data for this chunk
  const formData = new FormData();
  formData.append("chat_id", tgUploadId);
  formData.append("video", readStream, {
    filename: `chunk_${chunkNumber}_of_${uploadChunks}.mp4`,
    knownLength: chunkLength,
  });

  console.log(`UPLOADING CHUNK ${chunkNumber} of ${uploadChunks}`);
  console.log(`CHUNK SIZE: ${chunkEnd - chunkStart}`);
  console.log("--------------------------------");

  //set setting for auto play / streaming
  formData.append("supports_streaming", "true");
  formData.append("width", "1280");
  formData.append("height", "720");

  //add thumbnail
  // formData.append("thumb", fs.createReadStream(thumbnailPath));

  return formData;
};

// const start = i * uploadChunkSize;
// const end = Math.min(vidSizeBytes, start + uploadChunkSize);

//build chunk params
// const chunkParams = {
//   chunkStart: start,
//   chunkEnd: end,
//   chunkNumber: i,
//   uploadChunks: uploadChunks,
//   savePath: savePath,
//   tgUploadId: tgUploadId,
//   thumbnailPath: thumbnailPath,
// };s

//PIC UPLOAD WORKS BUT SKIPPING BC UNNECESSARY [reformat later]

//make an item NORMAL here (for label)

// const dateNormal = new Date(date).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });

// //upload thumbnail
// const picParams = {
//   picId: itemId,
//   savePath: thumbnailSavePath,
//   dateNormal: dateNormal,
//   tgUploadId: tgUploadId,
// };

// const picUploadData = await uploadPicFS(picParams);
// console.log("PIC UPLOAD DATA");
// console.log(picUploadData);
// console.log("--------------------------------");

// if (!picUploadData) return null;

// export const uploadPicFS = async (inputObj) => {
//   const { picId, savePath, dateNormal, tgUploadId } = inputObj;

//   //build pic params
//   const picParams = {
//     chatId: tgUploadId,
//     picPath: savePath,
//   };

//   const picData = await tgPostPicReq(picParams);
//   if (!picData) return null;

//   //build caption
//   const caption = "<b>PIC: " + picId + ".jpg</b>" + "\n" + "<i>" + dateNormal + "</i>";

//   //build edit caption params
//   const editParams = {
//     editChannelId: picData.result.chat.id,
//     messageId: picData.result.message_id,
//     caption: caption,
//   };

//   const editCaptionData = await tgEditMessageCaption(editParams);
//   return editCaptionData;
// };
