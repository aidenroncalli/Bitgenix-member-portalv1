import { supabase } from "./supabase"

export interface Member {
  id: string
  authId: string | null
  name: string
  role: string
  email: string
  phone: string
  location: string
  joinDate: string
  avatar: string
  bio: string
  specialisations: string[]
}

export interface Query {
  id: string
  name: string
  email: string
  subject: string
  message: string
  date: string
  status: "pending" | "answered" | "cleared"
}

export interface Project {
  id: string
  title: string
  category: string
  description: string
  image: string
  liveUrl: string
  tags: string[]
  status: "published" | "draft" | "archived"
  lastUpdated: string
  featured: boolean
}

export type NewProject = Omit<Project, "id" | "lastUpdated">

interface MemberRow {
  id: string | number
  auth_user_id: string | null
  Name: string | null
  Email: string | null
  Role: string | null
  Bio: string | null
  phone: string | null
  location: string | null
  join_date: string | null
  specialisations: string[] | null
  created_at: string
}
interface ProjectRow {
  id: string | number
  Title: string | null
  Description: string | null
  Image: string | null
  Status: string | null
  category: string | null
  live_url: string | null
  tags: string[] | null
  featured: boolean | null
  updated_at: string | null
  created_at: string
}
interface QueryRow {
  id: string | number
  Name: string | null
  Email: string | null
  Subject: string | null
  Message: string | null
  Status: string | null
  created_at: string
}

const memberColumns =
  "id,auth_user_id,Name,Email,Role,Bio,phone,location,join_date,specialisations,created_at"
const projectColumns =
  "id,Title,Description,Image,Status,category,live_url,tags,featured,updated_at,created_at"
const queryColumns = "id,Name,Email,Subject,Message,Status,created_at"

export function initials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0] ?? "")
      .join("")
      .toUpperCase() || "M"
  )
}
function mapMember(row: MemberRow): Member {
  return {
    id: String(row.id),
    authId: row.auth_user_id,
    name: row.Name ?? "",
    role: row.Role ?? "Member",
    email: row.Email ?? "",
    phone: row.phone ?? "",
    location: row.location ?? "",
    joinDate:
      row.join_date ?? (row.created_at ? row.created_at.slice(0, 4) : ""),
    avatar: initials(row.Name ?? ""),
    bio: row.Bio ?? "",
    specialisations: row.specialisations ?? [],
  }
}
function mapProject(row: ProjectRow): Project {
  const status = row.Status?.toLowerCase()
  return {
    id: String(row.id),
    title: row.Title ?? "",
    description: row.Description ?? "",
    image: row.Image ?? "",
    status: status === "published" || status === "archived" ? status : "draft",
    category: row.category ?? "",
    liveUrl: row.live_url ?? "",
    tags: row.tags ?? [],
    featured: row.featured ?? false,
    lastUpdated: row.updated_at ?? row.created_at,
  }
}
function mapQuery(row: QueryRow): Query {
  const status = row.Status?.toLowerCase()
  return {
    id: String(row.id),
    name: row.Name ?? "",
    email: row.Email ?? "",
    subject: row.Subject ?? "",
    message: row.Message ?? "",
    status: status === "answered" || status === "cleared" ? status : "pending",
    date: row.created_at,
  }
}

export function errorMessage(error: unknown): string {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error !== null && "message" in error
        ? String(error.message)
        : "An unexpected error occurred."
  if (/column .* does not exist|schema cache|PGRST204/i.test(message))
    return "Supabase is missing required portal columns. Apply the member portal migration, then retry."
  return message
}

export async function loadPortal(userId: string) {
  const [memberResult, projectResult, queryResult] = await Promise.all([
    supabase.from("Members").select(memberColumns).order("Name"),
    supabase
      .from("Projects")
      .select(projectColumns)
      .order("created_at", { ascending: false }),
    supabase
      .from("Queries")
      .select(queryColumns)
      .order("created_at", { ascending: false }),
  ])
  for (const result of [memberResult, projectResult, queryResult])
    if (result.error) throw result.error
  const members = (memberResult.data as unknown as MemberRow[]).map(mapMember)
  const member = members.find((item) => item.authId === userId)
  if (!member)
    throw new Error(
      "No member profile is linked to this account. Ask an administrator to add your Members row and link auth_user_id to your Supabase Auth user ID.",
    )
  return {
    member,
    members,
    projects: (projectResult.data as unknown as ProjectRow[]).map(mapProject),
    queries: (queryResult.data as unknown as QueryRow[]).map(mapQuery),
  }
}

export async function updateMember(
  id: string,
  userId: string,
  changes: Pick<Member, "name" | "phone" | "location" | "bio" | "specialisations">,
): Promise<Member> {
  const { data, error } = await supabase
    .from("Members")
    .update({
      Name: changes.name,
      phone: changes.phone,
      location: changes.location,
      Bio: changes.bio,
      specialisations: changes.specialisations,
    })
    .eq("id", id)
    .eq("auth_user_id", userId)
    .select(memberColumns)
    .single()
  if (error) throw error
  return mapMember(data as unknown as MemberRow)
}

export async function updateProject(
  id: string,
  changes: Partial<Project>,
): Promise<Project> {
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  const columns: Record<string, string> = {
    title: "Title",
    description: "Description",
    image: "Image",
    status: "Status",
    category: "category",
    liveUrl: "live_url",
    tags: "tags",
    featured: "featured",
  }
  for (const [key, value] of Object.entries(changes))
    if (key in columns) patch[columns[key]] = value
  const { data, error } = await supabase
    .from("Projects")
    .update(patch)
    .eq("id", id)
    .select(projectColumns)
    .single()
  if (error) throw error
  return mapProject(data as unknown as ProjectRow)
}

export async function createProject(
  userId: string,
  project: NewProject,
  imageFile?: File,
): Promise<Project> {
  let image = project.image.trim()
  let uploadedPath = ""

  if (imageFile) {
    const allowedImageTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
    ]
    if (!allowedImageTypes.includes(imageFile.type))
      throw new Error("Choose a JPG, PNG, WebP, or GIF image.")
    if (imageFile.size > 8 * 1024 * 1024)
      throw new Error("Project images must be smaller than 8 MB.")

    const safeName =
      imageFile.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-80) ||
      "project-image"
    uploadedPath = `${userId}/${crypto.randomUUID()}-${safeName}`
    const { error: uploadError } = await supabase.storage
      .from("portal-projects")
      .upload(uploadedPath, imageFile, {
        cacheControl: "3600",
        contentType: imageFile.type,
        upsert: false,
      })
    if (uploadError) throw uploadError
    image = supabase.storage.from("portal-projects").getPublicUrl(uploadedPath)
      .data.publicUrl
  }

  const { data, error } = await supabase
    .from("Projects")
    .insert({
      Title: project.title.trim(),
      Description: project.description.trim(),
      Image: image,
      Status: project.status,
      category: project.category.trim(),
      live_url: project.liveUrl.trim(),
      tags: project.tags,
      featured: project.featured,
      updated_at: new Date().toISOString(),
    })
    .select(projectColumns)
    .single()

  if (error) {
    if (uploadedPath)
      await supabase.storage.from("portal-projects").remove([uploadedPath])
    throw error
  }
  return mapProject(data as unknown as ProjectRow)
}

export async function updateQuery(
  id: string,
  status: Query["status"],
): Promise<Query> {
  const { data, error } = await supabase
    .from("Queries")
    .update({ Status: status })
    .eq("id", id)
    .select(queryColumns)
    .single()
  if (error) throw error
  return mapQuery(data as unknown as QueryRow)
}
