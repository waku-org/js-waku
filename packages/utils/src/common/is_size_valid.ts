const MB = 1024 ** 2;
const SIZE_CAP = 1; // 1 MB

export const isSizeUnderCap = (payload: Uint8Array): boolean => {
  if (payload.length / MB > SIZE_CAP) {
    return false;
  }

  return true;
};
