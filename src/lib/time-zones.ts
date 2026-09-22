/** Time zones grouped by region, labelled with their current UTC offset, for <select> menus. */
export function groupedTimeZones(now = Date.now()): Array<{ region: string; zones: { value: string; label: string }[] }> {
  let zones: string[];
  try {
    zones = Intl.supportedValuesOf("timeZone");
  } catch {
    zones = ["UTC"];
  }
  if (!zones.includes("UTC")) zones = ["UTC", ...zones];
  const groups = new Map<string, { value: string; label: string }[]>();
  for (const zone of zones) {
    const region = zone.includes("/") ? zone.split("/")[0] : "Other";
    let offset = "";
    try {
      offset =
        new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "shortOffset" })
          .formatToParts(now)
          .find((p) => p.type === "timeZoneName")?.value ?? "";
    } catch {
      /* ignore */
    }
    const city = zone.split("/").slice(1).join(" / ").replaceAll("_", " ") || zone;
    const list = groups.get(region) ?? [];
    list.push({ value: zone, label: `${city} (${offset.replace("GMT", "UTC") || "UTC"})` });
    groups.set(region, list);
  }
  return [...groups.entries()].map(([region, list]) => ({ region, zones: list }));
}
