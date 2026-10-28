export interface DbmlExample {
  key: string;
  label: string;
  code: string;
}

export const DBML_EXAMPLES: readonly DbmlExample[] = [
  {
    key: "blog",
    label: "Blog",
    code: `Table users {
  id integer [pk, increment]
  username varchar [not null, unique]
  email varchar [not null, unique]
  role user_role [default: 'member']
  created_at timestamp [default: \`now()\`]
}

Table posts {
  id integer [pk, increment]
  user_id integer [ref: > users.id, not null]
  title varchar [not null]
  body text
  status post_status [default: 'draft']
  created_at timestamp
}

Table comments {
  id integer [pk, increment]
  post_id integer [not null]
  user_id integer [not null]
  body text [not null]
  created_at timestamp
}

Ref: comments.post_id > posts.id
Ref: comments.user_id > users.id

Enum user_role {
  member
  editor
  admin
}

Enum post_status {
  draft
  published
  archived
}`,
  },
] as const;

export const DEFAULT_DBML_EXAMPLE: DbmlExample = DBML_EXAMPLES[0];
