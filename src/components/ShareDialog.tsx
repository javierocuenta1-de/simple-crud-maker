import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemId: string;
  itemName: string;
}

const ShareDialog = ({ open, onOpenChange, itemId, itemName }: ShareDialogProps) => {
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !email.trim()) return;
    setLoading(true);

    // Find user by email in profiles
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("email", email.trim())
      .maybeSingle();

    if (profileError || !profile) {
      toast.error("No se encontró un usuario con ese correo");
      setLoading(false);
      return;
    }

    if (profile.user_id === user.id) {
      toast.error("No puedes compartir contigo mismo");
      setLoading(false);
      return;
    }

    const { error } = await supabase.from("shared_items").insert({
      item_id: itemId,
      shared_by: user.id,
      shared_with: profile.user_id,
      can_edit: canEdit,
    });

    if (error) {
      if (error.code === "23505") {
        toast.error("Ya compartiste este elemento con ese usuario");
      } else {
        toast.error("Error al compartir");
      }
    } else {
      toast.success(`Compartido con ${email}`);
      setEmail("");
      setCanEdit(false);
      onOpenChange(false);
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Compartir "{itemName}"</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleShare} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="shareEmail">Correo del usuario</Label>
            <Input
              id="shareEmail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@ejemplo.com"
              required
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="canEdit">Permitir edición</Label>
            <Switch id="canEdit" checked={canEdit} onCheckedChange={setCanEdit} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || !email.trim()}>
              {loading ? "Compartiendo..." : "Compartir"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ShareDialog;
