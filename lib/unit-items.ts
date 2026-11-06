// The order of things inside a unit, as students see it (shared by server and client):
// Resources (a separate unit area) first, then the unit's modules in the order admin set.

/** Item keys for one unit: "resources" when it has resources, then "part:<module id>" for each module, in order */
export function unitItemKeys(hasResources: boolean, moduleIds: string[]): string[] {
  return [...(hasResources ? ["resources"] : []), ...moduleIds.map((id) => `part:${id}`)];
}
