import fs from "fs";
import fsPromises from "fs/promises";
import path from "path";
import FormData from "form-data";
import { exec } from "child_process/promises";

import CONFIG from "../config/config.js";
import dbModel from "../models/db-model.js";
import { scrapeState } from "./state.js";
import { tgSendMessage, tgPostPicFS, tgPostVidFS, tgEditMessageCaption } from "./tg-api.js";

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
      const vidDataObj = await uploadVidFolder(inputArray[i]);
      if (!vidDataObj) continue;
      uploadDataArray.push(vidDataObj);
    } catch (e) {
      console.log(`\nERROR! ${e.message} | FUNCTION: ${e.function} \n\n --------------------------------`);
      console.log(`\nARTICLE HTML: ${e.content} \n\n --------------------------------\n`);
    }
  }

  return uploadDataArray;
};

export const uploadVidFolder = async (inputObj) => {
  if (!inputObj || !inputObj.thumbnailSavePath || !inputObj.vidSavePath) return null;
  const { thumbnailSavePath, vidSavePath, vidData, vidName } = inputObj;
  const { tgUploadId } = CONFIG;

  //check first if vid exists
  if (!fs.existsSync(vidSavePath)) {
    const error = new Error("VID NOT DOWNLOADED");
    error.function = "uploadVidItem";
    error.content = inputObj;
    throw error;
  }

  //send title as MESSAGE first (thumbnail looks terrible)
  const titleCaption = await buildCaptionText(inputObj, "title");

  const titleParams = {
    chatId: tgUploadId,
    text: titleCaption,
  };

  const titleData = await tgSendMessage(titleParams);
  if (!titleData || !titleData.result) return null;

  //combine the vids in the directory
  const vidFolderArray = await combineVidFolder(inputObj);
};

export const buildCaptionText = async (inputObj, captionType = "title") => {
  if (!inputObj || !captionType) return null;
  const { date, type, title } = inputObj;

  const dateNormal = new Date(date).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
  const titleNormal = `<b>${title} ${type}</b>`;

  let captionText = "";
  switch (captionType) {
    case "title":
      const titleStr = "🇰🇵 🇰🇵 🇰🇵";
      captionText = `--------------\n\n${titleStr} ${titleNormal} ${titleStr}\n\n--------------`;
      return captionText;

    case "pic":
      const picTitleStr = "🇰🇵 🇰🇵 🇰🇵" + "\n\n";
      captionText = `${picTitleStr}--------------\n\n${titleNormal}\n<i>${dateNormal}</i>\n\n--------------`;
      return captionText;

    case "vid":
      break;
  }
};

export const combineVidFolder = async (inputObj) => {
  if (!inputObj || !inputObj.vidSavePath) return null;
  const { vidSavePath } = inputObj;
  const { tempPath } = CONFIG;

  //throw error if vid folder doesnt exist
  if (!fs.existsSync(vidSavePath)) {
    const error = new Error("VID FOLDER NOT FOUND");
    error.function = "combineVidFolder";
    error.content = inputObj;
    throw error;
  }

  //get the files in the folder
  const fileArray = fs.readdirSync(vidSavePath);
  if (!fileArray || !fileArray.length) return null;

  const vidListArray = await getVidListArray(fileArray);

  //throw error if no vids
  if (!vidListArray || !vidListArray.length) {
    const error = new Error("NO VIDS FOUND");
    error.function = "combineVidFolder";
    error.content = inputObj;
    throw error;
  }

  //HERE
  //NOW COMBINE THE VIDS IN EACH CHUNK ARRAY
  const vidListDataArray = [];
  for (let i = 0; i < vidListArray.length; i++) {
    try {
      const vidList = vidListArray[i];
      const vidListData = await combineVidList(vidList, inputObj);
      if (!vidListData) continue;

      vidListDataArray.push(vidListData);
    } catch (e) {
      console.log(`\nERROR! ${e.message} | FUNCTION: ${e.function} \n\n --------------------------------`);
    }
  }

  console.log("VID LIST DATA ARRAY");
  console.log(vidListDataArray);
  console.log("--------------------------------");

  return vidListDataArray;
};

//return array of vid arrays to combine
export const getVidListArray = async (inputArray) => {
  if (!inputArray || !inputArray.length) return null;
  const { vidUploadSize, vidChunkSize } = CONFIG;

  //set the number of vids to combine
  const maxVids = Math.ceil(vidUploadSize / vidChunkSize);

  //sort the fuckign array by number HERE
  const sortArray = inputArray.sort((a, b) => {
    const numA = parseInt(a.match(/chunk_(\d+)\.mp4/)[1]);
    const numB = parseInt(b.match(/chunk_(\d+)\.mp4/)[1]);
    return numA - numB;
  });

  const vidListArray = [];
  let currentList = [];
  for (let i = 0; i < sortArray.length; i++) {
    const file = sortArray[i];

    //only add .mp4 files
    if (!file.endsWith(".mp4")) continue;

    currentList.push(file);

    if (currentList.length === maxVids || currentList.length > maxVids) {
      vidListArray.push(currentList);
      currentList = [];
    }
  }

  //get last item
  if (currentList && currentList.length > 0) {
    vidListArray.push(currentList);
  }

  return vidListArray;
};

export const combineVidList = async (inputArray, inputObj) => {
  if (!inputArray || !inputArray.length || !inputObj) return null;
  const { vidName } = inputObj;
  const { tempPath } = CONFIG;

  //create temp file for ffmpeg
  const listFilePath = tempPath + vidName + "_list.txt";
  const outputFilePath = tempPath + vidName + "_combined.mp4";

  //create file content
  let fileContent = "";
  for (let i = 0; i < inputArray.length; i++) {
    const vidFile = inputArray[i];
    fileContent += `file '${vidFile}'`;
    if (i < inputArray.length - 1) {
      fileContent += "\n";
    }
  }

  //run ffmpeg
  const vidListData = await runFfmpeg(inputArray, listFilePath, outputFilePath);
  return vidListData;
};

export const runFfmpeg = async (inputArray, listFilePath, outputFilePath) => {
  await fsPromises.writeFile(listFilePath, fileContent);

  const ffmpegCommand = `cd "${vidSavePath}" && ffmpeg -f concat -safe 0 -i "videos_list.txt" -c copy "${path.resolve(outputFilePath)}" -y`;

  console.log(`Combining ${inputArray.length} videos from ${vidSavePath}`);
  console.log("--------------------------------");

  const { stderr, stdout } = await exec(ffmpegCommand);

  if (stderr) {
    console.log("FFmpeg stderr:", stderr);
  }

  console.log("FFmpeg stdout:", stdout);
  console.log("--------------------------------");

  // Clean up the temporary list file
  await fsPromises.unlink(listFilePath);

  return stdout;
};

//uploads thumbnail and vid SEPARATELY (might want to change)
// export const uploadVidFS = async (inputObj) => {
//   if (!inputObj) return null;
//   const { thumbnailSavePath, vidSavePath, date, vidData, vidName } = inputObj;
//   const { vidSizeBytes, vidSizeMB } = vidData;
//   const { uploadChunkSize, tgUploadId } = CONFIG;

//   // console.log("UPLOAD CHUNK SIZE");
//   // console.log(uploadChunkSize);
//   // console.log("--------------------------------");

//   const uploadChunks = Math.ceil(vidSizeBytes / uploadChunkSize);

//   // console.log("UPLOAD CHUNKS");
//   // console.log(uploadChunks);
//   // console.log(vidSizeMB + "MB");
//   // console.log("--------------------------------");

//   //check if vid downloaded
//   // if (!fs.existsSync(thumbnailSavePath) || !fs.existsSync(vidSavePath)) {
//   if (!fs.existsSync(vidSavePath)) {
//     const error = new Error("VidNOT downloaded");
//     error.function = "uploadVidFS";
//     error.content = inputObj;
//     throw error;
//   }

//   // //upload vid
//   const vidParams = {
//     thumbnailPath: thumbnailSavePath,
//     uploadChunkSize: uploadChunkSize,
//     vidSizeBytes: vidSizeBytes,
//     uploadChunks: uploadChunks,
//     vidName: vidName,
//     savePath: vidSavePath,
//     tgUploadId: tgUploadId,
//   };

//   const uploadChunkData = await uploadVidChunk(vidParams);

//   // console.log("VID PARAMS");
//   // console.log(vidParams);
//   // console.log("--------------------------------");

//   // console.log("VID UPLOAD DATA");s
//   // console.log(vidUploadData);
//   // console.log("--------------------------------");

//   // if (!vidUploadData) return null;
// };

// export const uploadVidChunk = async (inputObj) => {
//   if (!inputObj) return null;
//   const { thumbnailPath, uploadChunkSize, uploadChunks, vidName, savePath, dateNormal, vidSizeBytes, tgUploadId } = inputObj;

//   const chunkObj = { ...inputObj };

//   // console.log("upload VIDFS CHUNK SIZE");
//   // console.log(uploadChunkSize);
//   // console.log("--------------------------------");

//   const chunkDataArray = [];
//   for (let i = 0; i < uploadChunks; i++) {
//     if (!scrapeState.scrapeActive) return null;
//     try {
//       //define chunk start end
//       const start = i * uploadChunkSize;
//       const end = Math.min(vidSizeBytes, start + uploadChunkSize);

//       chunkObj.start = start;
//       chunkObj.end = end;
//       chunkObj.chunkNumber = i; //THIS WILL BREAK THINGS

//       // chunkParams.chunkStart = i * uploadChunkSize;
//       // chunkParams.chunkEnd = Math.min(vidSizeBytes, chunkParams.chunkStart + uploadChunkSize);
//       // chunkParams.chunkLength = chunkParams.chunkEnd - chunkParams.chunkStart;
//       // chunkParams.chunkNumber = i + 1; //THIS WILL BREAK THINGS

//       console.log("++++++++++++++++++++++++");
//       console.log(`NEW CHUNK! CHUNK START: ${start} | CHUNK END: ${end} | CHUNK NUMBER: ${chunkObj.chunkNumber}`);

//       console.log("CHUNK OBJ");
//       console.log(chunkObj);

//       const chunkForm = await buildChunkForm(chunkObj);

//       console.log("CHUNK FORM");
//       console.log(chunkForm);
//       console.log("--------------------------------");

//       const chunkPostData = await tgPostVidFS({ form: chunkForm });
//       if (!chunkPostData) continue;

//       chunkDataArray.push(chunkPostData);
//     } catch (e) {
//       console.log(`\nERROR! ${e.message} | FUNCTION: ${e.function} \n\n --------------------------------`);
//       console.log(`\nARTICLE HTML: ${e.content} \n\n --------------------------------\n`);
//     }
//   }

//   return chunkDataArray;
// };

// export const buildChunkForm = async (inputObj) => {
//   const { savePath, tgUploadId, thumbnailPath, start, end, chunkNumber, uploadChunks } = inputObj;

//   const readStream = fs.createReadStream(savePath, { start: start, end: end - 1 });

//   // Create form data for this chunk
//   const formData = new FormData();
//   formData.append("chat_id", tgUploadId);
//   formData.append("video", readStream, {
//     filename: `chunk_${chunkNumber}_of_${uploadChunks}.mp4`,
//     knownLength: end - start,
//   });

//   // console.log(`UPLOADING CHUNK ${chunkNumber} of ${uploadChunks}`);
//   // console.log(`CHUNK SIZE: ${chunkEnd - chunkStart}`);
//   // console.log("--------------------------------");

//   //set setting for auto play / streaming
//   formData.append("supports_streaming", "true");
//   formData.append("width", "1280");
//   formData.append("height", "720");

//   //add thumbnail
//   // formData.append("thumb", fs.createReadStream(thumbnailPath));

//   return formData;
// };

//  //upload thumbnail
//  const picParams = {
//   picId: vidName,
//   savePath: thumbnailSavePath,
//   tgUploadId: tgUploadId,
// };

// const uploadPicData = await uploadPicFS(picParams);
// console.log("PIC UPLOAD DATA");
// console.log(uploadPicData);
// console.log("--------------------------------");

// if (!uploadPicData) return null;

// return uploadPicData;

// //WORKS BUT THUMBNAIL LOOKS LIKE SHIT
// export const uploadPicFS = async (inputObj) => {
// const { picId, savePath, tgUploadId } = inputObj;

// //build pic params
// const picParams = {
//   chatId: tgUploadId,
//   picPath: savePath,
// };

// const picData = await tgPostPicFS(picParams);
// if (!picData || !picData.result) return null;

// // build caption
// const caption = await buildCaptionText(inputObj, "pic");

// //build edit caption params
// const editParams = {
//   editChannelId: picData.result.chat.id,
//   messageId: picData.result.message_id,
//   caption: caption,
// };

// const editCaptionData = await tgEditMessageCaption(editParams);
// return editCaptionData;
// };

//--------------------

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
