/**
 * StashDB GraphQL Queries
 */

export const SEARCH_PERFORMERS_QUERY = `
  query SearchPerformers($term: String!, $limit: Int!) {
    searchPerformer(term: $term, limit: $limit) {
      id
      name
      disambiguation
      aliases
      gender
      birth_date
      death_date
      career_start_year
      career_end_year
      images {
        id
        url
        width
        height
      }
    }
  }
`;

export const SEARCH_STUDIOS_QUERY = `
  query SearchStudios($term: String!, $limit: Int!) {
    searchStudio(term: $term, limit: $limit) {
      id
      name
      aliases
      parent {
        id
        name
      }
      images {
        id
        url
        width
        height
      }
      urls {
        url
        type
      }
    }
  }
`;

export const SEARCH_SCENES_QUERY = `
  query SearchScenes($term: String!, $limit: Int!) {
    searchScene(term: $term, limit: $limit) {
      id
      title
      date
      details
      duration
      code
      director
      urls {
        url
        type
      }
      images {
        id
        url
        width
        height
      }
      studio {
        id
        name
      }
      performers {
        performer {
          id
          name
          disambiguation
        }
        as
      }
      tags {
        id
        name
      }
    }
  }
`;

export const GET_PERFORMER_QUERY = `
  query GetPerformer($id: ID!) {
    findPerformer(id: $id) {
      id
      name
      disambiguation
      aliases
      gender
      birth_date
      death_date
      career_start_year
      career_end_year
      images {
        id
        url
        width
        height
      }
    }
  }
`;

export const GET_STUDIO_QUERY = `
  query GetStudio($id: ID!) {
    findStudio(id: $id) {
      id
      name
      aliases
      parent {
        id
        name
      }
      images {
        id
        url
        width
        height
      }
      urls {
        url
        type
      }
    }
  }
`;

export const GET_SCENE_QUERY = `
  query GetScene($id: ID!) {
    findScene(id: $id) {
      id
      title
      date
      details
      duration
      code
      director
      urls {
        url
        type
      }
      images {
        id
        url
        width
        height
      }
      studio {
        id
        name
      }
      performers {
        performer {
          id
          name
          disambiguation
        }
        as
      }
      tags {
        id
        name
      }
    }
  }
`;

export const GET_PERFORMER_SCENES_QUERY = `
  query GetPerformerScenes($id: ID!) {
    findPerformer(id: $id) {
      scenes {
        id
      }
    }
  }
`;

export const GET_STUDIO_SCENES_QUERY = `
  query GetStudioScenes($id: ID!) {
    findStudio(id: $id) {
      scenes {
        id
      }
    }
  }
`;
