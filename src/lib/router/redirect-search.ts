type SearchLocation<TSearch extends object = object> = {
  search: TSearch;
};

export function createRedirectWithSearch<const TTo extends string, TSearch extends object>(
  to: TTo,
  location: SearchLocation<TSearch>
): { to: TTo; search: TSearch } {
  return {
    to,
    search: location.search
  };
}
