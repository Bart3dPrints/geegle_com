export type PrepareLeave = () => Promise<boolean>;

interface Options {
  wantsGames: () => boolean;
  showGames: (games: boolean) => void;
  beginLeave: () => Promise<boolean>;
  stayOnGames: () => void;
  setPending: (pending: boolean) => void;
  warn: () => void;
}

export function platformNavigation(options: Options) {
  let games = options.wantsGames();
  let pending = false;

  return async () => {
    if (pending || games === options.wantsGames()) return;
    if (!games) {
      games = true;
      options.showGames(true);
      return;
    }

    pending = true;
    options.setPending(true);
    try {
      if (await options.beginLeave()) {
        games = options.wantsGames();
        options.showGames(games);
      } else if (!options.wantsGames()) {
        options.stayOnGames();
      }
    } catch {
      if (!options.wantsGames()) options.stayOnGames();
      options.warn();
    } finally {
      pending = false;
      options.setPending(false);
    }
  };
}
