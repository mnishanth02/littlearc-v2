type SystemPathEvent = {
  readonly path: string;
  readonly initial: boolean;
};

export function redirectSystemPath({ path }: SystemPathEvent): string {
  return path.startsWith("/") ? path : `/${path}`;
}
