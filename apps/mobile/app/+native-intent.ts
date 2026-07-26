import { getSharedPayloads } from "expo-sharing";

export async function redirectSystemPath(input: {
  readonly initial: boolean;
  readonly path: string;
}): Promise<string> {
  void input.initial;
  try {
    const url = new URL(input.path);
    if (
      url.protocol === "littlearc:" &&
      url.hostname === "expo-sharing" &&
      getSharedPayloads().length > 0
    ) {
      return "/capture?source=share";
    }
    return input.path;
  } catch {
    return "/";
  }
}
