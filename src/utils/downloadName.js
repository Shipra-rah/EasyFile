export function createRandomDownloadName(extension) {
  const number = Math.floor(100_000 + Math.random() * 9_900_000);
  const safeExtension = String(extension || "png")
    .replace(/^\.+/, "")
    .toLowerCase();

  return `${number}.${safeExtension}`;
}
