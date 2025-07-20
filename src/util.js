export const randomDelay = async (seconds = 1) => {
  const minDelay = 0;
  const maxDelay = seconds * 1000; //convert to milliseconds
  const randomMs = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
  //console.log(`Waiting for ${randomMs}ms before next request`);
  return new Promise((resolve) => setTimeout(() => resolve(randomMs), randomMs));
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
      const vidTitleStr = "🇰🇵 🇰🇵 🇰🇵";
      captionText = `--------------\n\n${vidTitleStr} ${titleNormal} ${vidTitleStr}\n\n--------------`;
      return captionText;
  }
};
