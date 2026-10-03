import { useState } from "react"
import { Edit3, Loader2 } from "lucide-react"
import { usePortal } from "./PortalBackend"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import { Textarea } from "./ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog"

export function ProfileEditor() {
  const { member, saveProfile, saving, refreshing } = usePortal()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState({
    name: "",
    phone: "",
    location: "",
    bio: "",
    specialisations: "",
  })
  const [error, setError] = useState("")
  function changeOpen(next: boolean) {
    if (saving) return
    if (next) {
      setDraft({
        name: member.name,
        phone: member.phone,
        location: member.location,
        bio: member.bio,
        specialisations: member.specialisations.join(", "),
      })
      setError("")
    }
    setOpen(next)
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!draft.name.trim()) {
      setError("Please enter your name.")
      return
    }
    const saved = await saveProfile({
      name: draft.name.trim(),
      phone: draft.phone.trim(),
      location: draft.location.trim(),
      bio: draft.bio.trim(),
      specialisations: draft.specialisations
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    })
    if (saved) setOpen(false)
    else
      setError(
        "Your changes were not saved. Check the connection message and try again.",
      )
  }
  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        <Button
          variant="secondary"
          size="sm"
          className="rounded-lg border border-border bg-secondary text-muted-foreground hover:bg-secondary/80"
          disabled={saving || refreshing}
        >
          <Edit3 className="size-3.5" />
          Edit profile
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-dvh overflow-y-auto border-border bg-popover">
        <DialogTitle>Edit profile</DialogTitle>
        <DialogDescription>
          Changes are saved to your Members row in Supabase. Your account email
          is managed by your administrator.
        </DialogDescription>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="member-name">Name</Label>
            <Input
              id="member-name"
              required
              value={draft.name}
              disabled={saving}
              onChange={(event) =>
                setDraft({ ...draft, name: event.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="member-phone">Phone</Label>
            <Input
              id="member-phone"
              type="tel"
              value={draft.phone}
              disabled={saving}
              onChange={(event) =>
                setDraft({ ...draft, phone: event.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="member-location">Location</Label>
            <Input
              id="member-location"
              value={draft.location}
              disabled={saving}
              onChange={(event) =>
                setDraft({ ...draft, location: event.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="member-bio">Bio</Label>
            <Textarea
              id="member-bio"
              value={draft.bio}
              disabled={saving}
              onChange={(event) =>
                setDraft({ ...draft, bio: event.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="member-specialisations">Specialisations</Label>
            <Input
              id="member-specialisations"
              value={draft.specialisations}
              disabled={saving}
              onChange={(event) =>
                setDraft({ ...draft, specialisations: event.target.value })
              }
            />
            <div className="text-xs text-muted-foreground">
              Separate each specialisation with a comma.
            </div>
          </div>
          {error && (
            <div role="alert" className="text-sm text-destructive">
              {error}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={saving}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" />}Save
              changes
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
