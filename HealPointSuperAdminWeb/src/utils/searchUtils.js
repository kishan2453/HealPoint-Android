export const normalizeSearchValue = (value) =>
  String(value ?? "").trim().toLowerCase();

export const buildSearchText = (values) =>
  values.map((value) => normalizeSearchValue(value)).join(" ");

export const matchesSearchText = (values, search) => {
  const searchText = normalizeSearchValue(search);
  if (!searchText) return true;

  return buildSearchText(values).includes(searchText);
};
