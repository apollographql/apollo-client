export const schema = {
  people: {
    "description": "A person within the Star Wars universe",
    "type": "object",
    "required": [
      "name",
      "height",
      "mass",
      "hair_color",
      "skin_color",
      "eye_color",
      "birth_year",
      "gender",
      "homeworld",
      "films",
      "species",
      "vehicles",
      "starships",
      "url"
    ],
    "properties": {
      "url": {
        "description": "The url of this resource",
        "type": "string"
      },
      "homeworld": {
        "description": "The url of the planet resource that this person was born on.",
        "type": "string"
      },
      "vehicles": {
        "description": "An array of vehicle resources that this person has piloted",
        "type": "array"
      },
      "films": {
        "description": "An array of urls of film resources that this person has been in.",
        "type": "array"
      },
      "starships": {
        "description": "An array of starship resources that this person has piloted",
        "type": "array"
      },
      "height": {
        "description": "The height of this person in meters.",
        "type": "string"
      },
      "skin_color": {
        "description": "The skin color of this person.",
        "type": "string"
      },
      "birth_year": {
        "description": "The birth year of this person. BBY (Before the Battle of Yavin) or ABY (After the Battle of Yavin).",
        "type": "string"
      },
      "eye_color": {
        "description": "The eye color of this person.",
        "type": "string"
      },
      "hair_color": {
        "description": "The hair color of this person.",
        "type": "string"
      },
      "gender": {
        "description": "The gender of this person (if known).",
        "type": "string"
      },
      "name": {
        "description": "The name of this person.",
        "type": "string"
      },
      "species": {
        "description": "The url of the species resource that this person is.",
        "type": "array"
      },
      "mass": {
        "description": "The mass of this person in kilograms.",
        "type": "string"
      }
    },
    "title": "People",
    "$schema": "http://json-schema.org/draft-04/schema"
  },

  planets: {
    "description": "A planet.",
    "type": "object",
    "required": [
      "name",
      "rotation_period",
      "orbital_period",
      "diameter",
      "climate",
      "gravity",
      "terrain",
      "surface_water",
      "population",
      "residents",
      "films",
      "created",
      "edited",
      "url"
    ],
    "properties": {
      "gravity": {
        "description": "A number denoting the gravity of this planet. Where 1 is normal.",
        "type": "string"
      },
      "population": {
        "description": "The average populationof sentient beings inhabiting this planet.",
        "type": "string"
      },
      "diameter": {
        "description": "The diameter of this planet in kilometers.",
        "type": "string"
      },
      "terrain": {
        "description": "the terrain of this planet. Comma-seperated if diverse.",
        "type": "string"
      },
      "url": {
        "description": "The hypermedia URL of this resource.",
        "type": "string"
      },
      "edited": {
        "description": "the ISO 8601 date format of the time that this resource was edited.",
        "type": "string"
      },
      "orbital_period": {
        "description": "The number of standard days it takes for this planet to complete a single orbit of its local star.",
        "type": "string"
      },
      "surface_water": {
        "description": "The percentage of the planet surface that is naturally occuring water or bodies of water.",
        "type": "string"
      },
      "created": {
        "description": "The ISO 8601 date format of the time that this resource was created.",
        "type": "string"
      },
      "residents": {
        "description": "An array of People URL Resources that live on this planet.",
        "type": "array"
      },
      "climate": {
        "description": "The climate of this planet. Comma-seperated if diverse.",
        "type": "string"
      },
      "name": {
        "description": "The name of this planet.",
        "type": "string"
      },
      "rotation_period": {
        "description": "The number of standard hours it takes for this planet to complete a single rotation on its axis.",
        "type": "string"
      },
      "films": {
        "description": "An array of Film URL Resources that this planet has appeared in.",
        "type": "array"
      }
    },
    "title": "Planet",
    "$schema": "http://json-schema.org/draft-04/schema"
  },

  films: {
    "description": "A Star Wars film",
    "type": "object",
    "required": [
      "title",
      "episode_id",
      "opening_crawl",
      "director",
      "producer",
      "release_date",
      "characters",
      "planets",
      "starships",
      "vehicles",
      "species",
      "url"
    ],
    "properties": {
      "producer": {
        "description": "The producer(s) of this film.",
        "type": "string"
      },
      "vehicles": {
        "description": "The vehicle resources featured within this film.",
        "type": "array"
      },
      "url": {
        "description": "The url of this resource",
        "type": "string"
      },
      "release_date": {
        "description": "The release date at original creator country.",
        "type": "date"
      },
      "opening_crawl": {
        "description": "The opening crawl text at the beginning of this film.",
        "type": "string"
      },
      "title": {
        "description": "The title of this film.",
        "type": "string"
      },
      "characters": {
        "description": "The people resources featured within this film.",
        "type": "array"
      },
      "starships": {
        "description": "The starship resources featured within this film.",
        "type": "array"
      },
      "planets": {
        "description": "The planet resources featured within this film.",
        "type": "array"
      },
      "episode_id": {
        "description": "The episode number of this film.",
        "type": "integer"
      },
      "director": {
        "description": "The director of this film.",
        "type": "string"
      },
      "species": {
        "description": "The species resources featured within this film.",
        "type": "array"
      }
    },
    "title": "Film",
    "$schema": "http://json-schema.org/draft-04/schema"
  },

  species: {
    "description": "A species within the Star Wars universe",
    "type": "object",
    "required": [
      "name",
      "height",
      "mass",
      "hair_color",
      "skin_color",
      "eye_color",
      "birth_year",
      "gender",
      "homeworld",
      "films",
      "species",
      "vehicles",
      "starships",
      "url"
    ],
    "properties": {
      "url": {
        "description": "The hypermedia URL of this resource.",
        "type": "string"
      },
      "designation": {
        "description": "The designation of this species.",
        "type": "string"
      },
      "films": {
        "description": " An array of Film URL Resources that this species has appeared in.",
        "type": "array"
      },
      "average_lifespan": {
        "description": "The average lifespan of this species in years.",
        "type": "string"
      },
      "edited": {
        "description": "the ISO 8601 date format of the time that this resource was edited.",
        "type": "string"
      },
      "hair_colors": {
        "description": "A comma-seperated string of common hair colors for this species, none if this species does not typically have hair.",
        "type": "string"
      },
      "created": {
        "description": " the ISO 8601 date format of the time that this resource was created.",
        "type": "string"
      },
      "people": {
        "description": "An array of People URL Resources that are a part of this species.",
        "type": "array"
      },
      "classification": {
        "description": "The classification of this species.",
        "type": "string"
      },
      "eye_colors": {
        "description": "A comma-seperated string of common eye colors for this species, none if this species does not typically have eyes.",
        "type": "string"
      },
      "language": {
        "description": "The language commonly spoken by this species.",
        "type": "string"
      },
      "skin_colors": {
        "description": "A comma-seperated string of common skin colors for this species, none if this species does not typically have skin.",
        "type": "string"
      },
      "homeworld": {
        "description": "The URL of a planet resource, a planet that this species originates from.",
        "type": "string"
      },
      "name": {
        "description": "The name of this species.",
        "type": "string"
      },
      "average_height": {
        "description": "The average height of this person in centimeters.",
        "type": "string"
      }
    },
    "title": "Species",
    "$schema": "http://json-schema.org/draft-04/schema"
  },

  vehicles: {
    "description": "A vehicle.",
    "type": "object",
    "required": [
      "name",
      "model",
      "manufacturer",
      "cost_in_credits",
      "length",
      "max_atmosphering_speed",
      "crew",
      "passengers",
      "cargo_capacity",
      "consumables",
      "vehicle_class",
      "pilots",
      "films",
      "created",
      "edited",
      "url"
    ],
    "properties": {
      "max_atmosphering_speed": {
        "description": "The maximum speed of this vehicle in atmosphere.",
        "type": "string"
      },
      "films": {
        "description": "An array of Film URL Resources that this vehicle has appeared in.",
        "type": "array"
      },
      "passengers": {
        "description": "The number of non-essential people this vehicle can transport.",
        "type": "string"
      },
      "url": {
        "description": "The hypermedia URL of this resource.",
        "type": "string"
      },
      "length": {
        "description": "The length of this vehicle in meters.",
        "type": "string"
      },
      "edited": {
        "description": "the ISO 8601 date format of the time that this resource was edited.",
        "type": "string"
      },
      "cargo_capacity": {
        "description": "The maximum number of kilograms that this vehicle can transport.",
        "type": "string"
      },
      "created": {
        "description": "The ISO 8601 date format of the time that this resource was created.",
        "type": "string"
      },
      "consumables": {
        "description": "The maximum length of time that this vehicle can provide consumables for its entire crew without having to resupply.",
        "type": "string"
      },
      "cost_in_credits": {
        "description": "The cost of this vehicle new, in galactic credits.",
        "type": "string"
      },
      "crew": {
        "description": "The number of personnel needed to run or pilot this vehicle.",
        "type": "string"
      },
      "pilots": {
        "description": "An array of People URL Resources that this vehicle has been piloted by.",
        "type": "array"
      },
      "name": {
        "description": "The name of this vehicle. The common name, such as Sand Crawler.",
        "type": "string"
      },
      "model": {
        "description": "The model or official name of this vehicle. Such as All Terrain Attack Transport.",
        "type": "string"
      },
      "manufacturer": {
        "description": "The manufacturer of this vehicle. Comma seperated if more than one.",
        "type": "string"
      },
      "vehicle_class": {
        "description": "The class of this vehicle, such as Wheeled.",
        "type": "string"
      }
    },
    "title": "Vehicle",
    "$schema": "http://json-schema.org/draft-04/schema"
  },

  starships: {
    "description": "A Starship",
    "type": "object",
    "required": [
      "name",
      "model",
      "manufacturer",
      "cost_in_credits",
      "length",
      "max_atmosphering_speed",
      "crew",
      "passengers",
      "cargo_capacity",
      "consumables",
      "hyperdrive_rating",
      "MGLT",
      "starship_class",
      "pilots",
      "films",
      "created",
      "edited",
      "url"
    ],
    "properties": {
      "max_atmosphering_speed": {
        "description": "The maximum speed of this starship in atmosphere. n/a if this starship is incapable of atmosphering flight.",
        "type": "string"
      },
      "starship_class": {
        "description": "The class of this starship, such as Starfighter or Deep Space Mobile Battlestation.",
        "type": "string"
      },
      "films": {
        "description": "An array of Film URL Resources that this starship has appeared in.",
        "type": "array"
      },
      "passengers": {
        "description": "The number of non-essential people this starship can transport.",
        "type": "string"
      },
      "MGLT": {
        "description": "The Maximum number of Megalights this starship can travel in a standard hour. A Megalight is a standard unit of distance and has never been defined before within the Star Wars universe. This figure is only really useful for measuring the difference in speed of starships. We can assume it is similar to AU, the distance between our Sun (Sol) and Earth.",
        "type": "string"
      },
      "length": {
        "description": "The length of this starship in meters.",
        "type": "string"
      },
      "hyperdrive_rating": {
        "description": "The class of this starships hyperdrive.",
        "type": "string"
      },
      "edited": {
        "description": "the ISO 8601 date format of the time that this resource was edited.",
        "type": "string"
      },
      "created": {
        "description": "The ISO 8601 date format of the time that this resource was created.",
        "type": "string"
      },
      "consumables": {
        "description": "The maximum length of time that this starship can provide consumables for its entire crew without having to resupply.",
        "type": "string"
      },
      "cost_in_credits": {
        "description": "The cost of this starship new, in galactic credits.",
        "type": "string"
      },
      "crew": {
        "description": "The number of personnel needed to run or pilot this starship.",
        "type": "string"
      },
      "pilots": {
        "description": "An array of People URL Resources that this starship has been piloted by.",
        "type": "array"
      },
      "name": {
        "description": "The name of this starship. The common name, such as Death Star.",
        "type": "string"
      },
      "model": {
        "description": "The model or official name of this starship. Such as T-65 X-wing or DS-1 Orbital Battle Station.",
        "type": "string"
      },
      "manufacturer": {
        "description": "The manufacturer of this starship. Comma seperated if more than one.",
        "type": "string"
      },
      "cargo_capacity": {
        "description": "The maximum number of kilograms that this starship can transport.",
        "type": "string"
      },
      "url": {
        "description": "The hypermedia URL of this resource.",
        "type": "string"
      }
    },
    "title": "Starship",
    "$schema": "http://json-schema.org/draft-04/schema"
  }
}
