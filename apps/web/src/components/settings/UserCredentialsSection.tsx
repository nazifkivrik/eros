"use client";

import { useState } from "react";
import { Key, Loader2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export function UserCredentialsSection() {
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [isUsernameDialogOpen, setIsUsernameDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentUsername, setCurrentUsername] = useState("admin"); // TODO: Get from API

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [usernameForm, setUsernameForm] = useState({
    currentPassword: "",
    newUsername: "",
  });

  const [error, setError] = useState("");

  const handleChangePassword = async () => {
    setError("");

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError("New passwords do not match");
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      setError("New password must be at least 8 characters");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/settings/user/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success("Password changed successfully");
        setIsPasswordDialogOpen(false);
        setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      } else {
        setError(result.message || "Failed to change password");
      }
    } catch (err) {
      setError("Failed to change password. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangeUsername = async () => {
    setError("");

    if (usernameForm.newUsername.length < 3) {
      setError("Username must be at least 3 characters");
      return;
    }

    if (usernameForm.newUsername.length > 50) {
      setError("Username must be at most 50 characters");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/settings/user/change-username", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: usernameForm.currentPassword,
          newUsername: usernameForm.newUsername,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success("Username changed successfully");
        setCurrentUsername(usernameForm.newUsername);
        setIsUsernameDialogOpen(false);
        setUsernameForm({ currentPassword: "", newUsername: "" });
      } else {
        setError(result.message || "Failed to change username");
      }
    } catch (err) {
      setError("Failed to change username. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-base">User Credentials</Label>
        <p className="text-sm text-muted-foreground">
          Manage your account username and password
        </p>
      </div>

      <div className="p-4 rounded-lg border bg-card">
        <div className="space-y-3">
          <div>
            <Label>Username</Label>
            <div className="text-sm mt-1 font-medium">{currentUsername}</div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setIsUsernameDialogOpen(true)}
              className="flex-1 sm:flex-none"
            >
              <User className="h-4 w-4 mr-2" />
              Change Username
            </Button>
            <Button
              variant="outline"
              onClick={() => setIsPasswordDialogOpen(true)}
              className="flex-1 sm:flex-none"
            >
              <Key className="h-4 w-4 mr-2" />
              Change Password
            </Button>
          </div>
        </div>
      </div>

      {/* Change Username Dialog */}
      <Dialog open={isUsernameDialogOpen} onOpenChange={setIsUsernameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Username</DialogTitle>
            <DialogDescription>
              Enter your current password and a new username to update your account.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {error && (
              <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="current-username-password">Current Password</Label>
              <Input
                id="current-username-password"
                type="password"
                value={usernameForm.currentPassword}
                onChange={(e) => setUsernameForm({ ...usernameForm, currentPassword: e.target.value })}
                placeholder="Enter current password"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-username">New Username</Label>
              <Input
                id="new-username"
                type="text"
                value={usernameForm.newUsername}
                onChange={(e) => setUsernameForm({ ...usernameForm, newUsername: e.target.value })}
                placeholder="Enter new username (3-50 characters)"
                minLength={3}
                maxLength={50}
              />
              <p className="text-xs text-muted-foreground">
                Must be between 3 and 50 characters
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsUsernameDialogOpen(false);
                setError("");
                setUsernameForm({ currentPassword: "", newUsername: "" });
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleChangeUsername} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Changing...
                </>
              ) : (
                "Change Username"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Password Dialog */}
      <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>
              Enter your current password and a new password to update your credentials.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {error && (
              <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="current-password">Current Password</Label>
              <Input
                id="current-password"
                type="password"
                value={passwordForm.currentPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                placeholder="Enter current password"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                placeholder="Enter new password (min 8 characters)"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                placeholder="Confirm new password"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsPasswordDialogOpen(false);
                setError("");
                setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleChangePassword} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Changing...
                </>
              ) : (
                "Change Password"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
