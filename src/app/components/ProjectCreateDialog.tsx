import { useEffect, useState } from "react"
import { ImagePlus, Loader2, Plus, Sparkles, Upload } from "lucide-react"
import type { NewProject, Project } from "../lib/portal-data"
import { usePortal } from "./PortalBackend"
import { Button } from "./ui/button"
import { Checkbox } from "./ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select"
import { Textarea } from "./ui/textarea"

const emptyProject: NewProject = {
  title: "",
  category: "",
  description: "",
  image: "",
  liveUrl: "",
  tags: [],
  status: "draft",
  featured: false,
}

export function ProjectCreateDialog() {
  const { addProject, saving, refreshing } = usePortal()
  const [open, setOpen] = useState(false)
  const [project, setProject] = useState<NewProject>(emptyProject)
  const [tags, setTags] = useState("")
  const [imageFile, setImageFile] = useState<File>()
  const [preview, setPreview] = useState("")

  useEffect(() => {
    if (!imageFile) {
      setPreview("")
      return
    }
    const objectUrl = URL.createObjectURL(imageFile)
    setPreview(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [imageFile])

  function reset() {
    setProject(emptyProject)
    setTags("")
    setImageFile(undefined)
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    const created = await addProject(
      {
        ...project,
        title: project.title.trim(),
        tags: tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
      },
      imageFile,
    )
    if (created) {
      setOpen(false)
      reset()
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!saving) setOpen(next)
      }}
    >
      <DialogTrigger asChild>
        <Button className="rounded-xl shadow-lg shadow-primary/20">
          <Plus className="size-4" />
          New Project
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl border-border bg-popover/90 p-0 shadow-2xl backdrop-blur-2xl sm:max-w-2xl">
        <div className="relative overflow-hidden border-b border-border px-6 py-5">
          <div className="pointer-events-none absolute -right-10 -top-16 size-40 rounded-full bg-accent/20 blur-3xl" />
          <div className="pointer-events-none absolute right-20 top-8 size-20 rounded-full bg-primary/15 blur-2xl" />
          <DialogHeader className="relative">
            <div className="mb-1 flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-lg shadow-primary/20">
              <Sparkles className="size-5" />
            </div>
            <DialogTitle>Create a new project</DialogTitle>
            <DialogDescription>
              Add the project details here. It will be saved to Supabase
              immediately.
            </DialogDescription>
          </DialogHeader>
        </div>
        <form onSubmit={submit} className="space-y-5 px-6 pb-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="new-project-title">Project name</Label>
              <Input
                id="new-project-title"
                required
                autoFocus
                disabled={saving}
                value={project.title}
                onChange={(event) =>
                  setProject({ ...project, title: event.target.value })
                }
                placeholder="Project name"
                className="rounded-xl border-border bg-secondary"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-project-category">Category</Label>
              <Input
                id="new-project-category"
                disabled={saving}
                value={project.category}
                onChange={(event) =>
                  setProject({ ...project, category: event.target.value })
                }
                placeholder="Web, Brand, Product…"
                className="rounded-xl border-border bg-secondary"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-project-status">Status</Label>
              <Select
                value={project.status}
                disabled={saving}
                onValueChange={(status: Project["status"]) =>
                  setProject({ ...project, status })
                }
              >
                <SelectTrigger
                  id="new-project-status"
                  className="rounded-xl border-border bg-secondary"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-border bg-popover">
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="new-project-description">Description</Label>
              <Textarea
                id="new-project-description"
                required
                rows={4}
                disabled={saving}
                value={project.description}
                onChange={(event) =>
                  setProject({ ...project, description: event.target.value })
                }
                placeholder="What makes this project special?"
                className="resize-none rounded-xl border-border bg-secondary"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="new-project-image">Project image</Label>
              <div className="relative overflow-hidden rounded-2xl border border-dashed border-border bg-secondary/60">
                {preview ? (
                  <img
                    src={preview}
                    alt="Project upload preview"
                    className="h-40 w-full object-cover"
                  />
                ) : (
                  <div className="flex h-32 flex-col items-center justify-center gap-2 text-muted-foreground">
                    <ImagePlus className="size-7 text-primary" />
                    <span className="text-xs">
                      PNG, JPG or WebP, up to 8 MB
                    </span>
                  </div>
                )}
                <Input
                  id="new-project-image"
                  type="file"
                  accept="image/*"
                  disabled={saving}
                  onChange={(event) =>
                    setImageFile(event.target.files?.[0] || undefined)
                  }
                  className="rounded-none border-0 border-t border-border bg-secondary file:text-primary"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-project-image-url">Or use an image URL</Label>
              <Input
                id="new-project-image-url"
                type="url"
                disabled={saving || Boolean(imageFile)}
                value={project.image}
                onChange={(event) =>
                  setProject({ ...project, image: event.target.value })
                }
                placeholder="https://…"
                className="rounded-xl border-border bg-secondary"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-project-live-url">Live project URL</Label>
              <Input
                id="new-project-live-url"
                type="url"
                disabled={saving}
                value={project.liveUrl}
                onChange={(event) =>
                  setProject({ ...project, liveUrl: event.target.value })
                }
                placeholder="https://…"
                className="rounded-xl border-border bg-secondary"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="new-project-tags">Tags</Label>
              <Input
                id="new-project-tags"
                disabled={saving}
                value={tags}
                onChange={(event) => setTags(event.target.value)}
                placeholder="React, Supabase, Design"
                className="rounded-xl border-border bg-secondary"
              />
              <div className="text-xs text-muted-foreground">
                Separate tags with commas.
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-border bg-secondary/60 p-3 sm:col-span-2">
              <Checkbox
                id="new-project-featured"
                checked={project.featured}
                disabled={saving}
                onCheckedChange={(checked) =>
                  setProject({ ...project, featured: checked === true })
                }
              />
              <Label
                htmlFor="new-project-featured"
                className="flex-1 cursor-pointer text-sm"
              >
                Feature this project on the website
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              className="rounded-xl"
              disabled={saving}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="rounded-xl"
              disabled={saving || refreshing || !project.title.trim()}
            >
              {saving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              {saving ? "Creating…" : "Create Project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
