import { Tuple } from "elysia/dist/types";
import {
  createBuilding,
  BuildingKind,
  BuildingVariantMap,
  MapBuildings,
} from "./buildings/buildings";
import * as z from "zod";
import {
  BuildingVariantsMap,
  MAP_HEIGHT,
  MAP_WIDTH,
} from "./buildings/globals";

// A Tiled Map has multiple layers and multiple tilesets
// At the moment the code ONLY loads the first layer
// Multiple tilesets are supported with the following conditions:
// For the moment the source field indicating the path to the tileset must have the same name as the tileset name field,
// we are not loading the tilesets from the source bc we want to have the original map in a different folders and have it still work if you just copy over the files.
// (otherwise the paths of the tilesets are f***ed ...) This could change in the future.

// Zod map schema to parse and validate the Tiled map, typesafe
const MapSchema = z.object({
  layers: z.array(
    z.object({
      data: z.array(z.number()),
    }),
  ),
  tilesets: z.array(
    z.object({
      firstgid: z.number(),
      source: z.string(),
    }),
  ),
  width: z.number(),
  height: z.number(),
});

// Zod tileset schema to parse and validate the Tiled tileset, typesafe
const TilePropertySchema = z.object({
  name: z.enum(["name", "variant"]),
  value: z.string(),
});

const TileSchema = z
  .object({
    id: z.number(),
    properties: z.tuple([TilePropertySchema, TilePropertySchema]),
  })
  .superRefine((tile, ctx) => {
    const [firstProp, secondProp] = tile.properties;

    if (firstProp.name == secondProp.name) {
      ctx.addIssue({
        code: "custom",
        path: ["properties"],
        message:
          "Expected two properties with different names ('name' and 'variant')",
      });
      return;
    }

    let nameProp = firstProp.name == "name" ? firstProp : secondProp;
    let variantProp = firstProp.name == "variant" ? firstProp : secondProp;

    if (!(nameProp.value in BuildingVariantsMap)) {
      ctx.addIssue({
        code: "custom",
        path: ["properties", nameProp == firstProp ? 0 : 1, "value"],
        message: `'${nameProp.value}' is not a valid building`,
      });
      return;
    }
    // @ts-ignore
    if (!BuildingVariantsMap[nameProp.value].includes(variantProp.value)) {
      ctx.addIssue({
        code: "custom",
        path: ["properties", variantProp == firstProp ? 0 : 1, "value"],
        message: `'${variantProp.value}' is not a valid variant for the building '${nameProp.value}'`,
      });
      return;
    }
  })
  .transform((data) => ({
    id: data.id,
    name:
      data.properties[0].name == "name"
        ? data.properties[0].value
        : data.properties[1].value,
    variant:
      data.properties[0].name == "variant"
        ? data.properties[0].value
        : data.properties[1].value,
  }));

type ParsedTileset = {
  name: string;
  tiles: Array<
    {
      [K in BuildingKind]: {
        id: number;
        name: K;
        variant: BuildingVariantMap[K];
      };
    }[BuildingKind] // [BuildingKind] makes it a | list insteas of an &
  >;
};
const TilesetSchema = z
  .object({
    tiles: z.array(TileSchema),
    name: z.string(),
  })
  .transform((data) => {
    return data as ParsedTileset;
  });

// Helper function to just load a JSON file
async function loadJSON(path: string) {
  const file = Bun.file(path);
  const data = await file.json();
  return data;
}

// The main function
export async function loadMap(mapPath: string, tilesetPaths: string[]) {
  // Parse the single map
  const rawMap = await loadJSON(mapPath);
  const map = MapSchema.parse(rawMap);

  if (map.width < 0 || map.height < 0)
    throw new Error(
      "Invalid Tiled Map: " +
        "the map should have positive dimensions ('width', 'height')",
    );

  // Parse all the tilesets
  const tilesets: { [k: string]: ParsedTileset } = {};

  await Promise.all(
    tilesetPaths.map(async (tilesetPath) => {
      const rawTileset = await loadJSON(tilesetPath);
      const t = TilesetSchema.parse(rawTileset);
      tilesets[t.name] = t;
    }),
  );

  if (map.layers.length == 0 || map.tilesets.length == 0)
    new Error("Invalid Map");

  // Get only the tiles of the first layer of the map
  const tiles: number[] = map.layers[0].data;

  // Get a binding of the tile number (in the map) and the tile name and variant (in the right tileset)
  type BuildingByKind = {
    [K in BuildingKind]: {
      name: K;
      variant: BuildingVariantMap[K];
    };
  };
  const tileBindings: Record<number, BuildingByKind[BuildingKind]> = {};

  map.tilesets.forEach((t) => {
    const t_key =
      String(t.source)
        .split(/[\\/]/)
        .pop()
        ?.replace(/\.[^/.]+$/, "") || "_";
    if (t_key in tilesets)
      tilesets[t_key].tiles.forEach((tileData) => {
        tileBindings[tileData.id + t.firstgid] = tileData;
      });
  });

  //populate the server authoritative global buildings in the map

  const serverBuildingsMap = new MapBuildings(map.width, map.height);
  let x = 0;
  let y = 0;
  let i = 0;

  for (const tile of tiles) {
    if (tile in tileBindings) {
      let res = serverBuildingsMap.createAndAddBuilding(
        tileBindings[tile].name,
        tileBindings[tile].variant,
        x,
        y,
        i,
      );
      if (res) console.error("Error while trying to parse prebuilt map: ", res);
    }

    i++;
    x = i % MAP_WIDTH;
    y = Math.floor(i / MAP_HEIGHT);
  }

  // For debug purposes display the in-memory map
  // serverBuildingsMap._displayDebugMap();

  return serverBuildingsMap;
}
