import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { updateMyLocation, updateMyProfile } from "@/lib/profile.functions";
import { directoryQuery } from "@/lib/queries";

export function ProfileSettingsCard({
  profile,
}: {
  profile: {
    handle: string;
    display_name: string;
    bio: string | null;
    city_id: string | null;
    city: { name: string } | null;
    province: { name: string } | null;
    country: { name: string } | null;
    region: { name: string } | null;
  };
}) {
  const queryClient = useQueryClient();
  const saveProfile = useServerFn(updateMyProfile);
  const saveLocation = useServerFn(updateMyLocation);
  const { data: directory } = useQuery(directoryQuery());

  const [handle, setHandle] = useState(profile.handle);
  const [displayName, setDisplayName] = useState(profile.display_name);
  const [bio, setBio] = useState(profile.bio ?? "");
  const [cityId, setCityId] = useState(profile.city_id ?? "");

  const cities = (directory?.regions ?? []).filter((region) => region.kind === "city");

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["my-dashboard"] });
  };

  const identity = useMutation({
    mutationFn: () => saveProfile({ data: { handle, displayName, bio } }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Profile updated.");
      invalidate();
    },
    onError: () => toast.error("Could not update your profile."),
  });

  const location = useMutation({
    mutationFn: (id: string) => saveLocation({ data: { cityId: id } }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        `Location set to ${[result.location.city, result.location.province, result.location.country, result.location.region]
          .filter(Boolean)
          .join(" → ")}`,
      );
      invalidate();
    },
    onError: () => toast.error("Could not update your location."),
  });

  return (
    <div className="bg-surface-gradient shadow-card rounded-lg border border-border p-5">
      <p className="eyebrow">Public profile</p>

      <form
        className="mt-4 space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!identity.isPending) identity.mutate();
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="handle">Handle</Label>
            <Input
              id="handle"
              value={handle}
              onChange={(event) => setHandle(event.target.value)}
              className="mt-2"
              required
            />
            <p className="mt-1 text-xs text-muted-foreground">
              3–20 characters, lowercase letters, numbers and underscores.
            </p>
          </div>
          <div>
            <Label htmlFor="displayName">Display name</Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              className="mt-2"
              required
            />
          </div>
        </div>
        <div>
          <Label htmlFor="bio">Bio</Label>
          <Textarea
            id="bio"
            value={bio}
            onChange={(event) => setBio(event.target.value)}
            className="mt-2"
            maxLength={280}
            rows={3}
          />
        </div>
        <Button type="submit" disabled={identity.isPending}>
          {identity.isPending ? "Saving…" : "Save profile"}
        </Button>
      </form>

      <div className="mt-6 border-t border-border pt-5">
        <Label htmlFor="city">Location</Label>
        <p className="mt-1 text-xs text-muted-foreground">
          Pick your city — EloShape resolves province, country and region for you.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Select
            value={cityId}
            onValueChange={(value) => {
              setCityId(value);
              location.mutate(value);
            }}
          >
            <SelectTrigger id="city" className="w-64" disabled={location.isPending}>
              <SelectValue placeholder="Select your city" />
            </SelectTrigger>
            <SelectContent>
              {cities.map((city) => (
                <SelectItem key={city.id} value={city.id}>
                  {city.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">
            {[profile.city?.name, profile.province?.name, profile.country?.name, profile.region?.name]
              .filter(Boolean)
              .join(" → ") || "No location set"}
          </span>
        </div>
      </div>
    </div>
  );
}
