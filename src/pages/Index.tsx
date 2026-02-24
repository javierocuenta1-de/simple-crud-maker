import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Package, Share2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import ItemDialog from "@/components/ItemDialog";
import ShareDialog from "@/components/ShareDialog";
import ThemeToggle from "@/components/ThemeToggle";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface DbItem {
  id: string;
  user_id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
}

const Index = () => {
  const { user, signOut } = useAuth();
  const [items, setItems] = useState<DbItem[]>([]);
  const [sharedItems, setSharedItems] = useState<(DbItem & { can_edit: boolean })[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<DbItem | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [shareItem, setShareItem] = useState<{ id: string; name: string } | null>(null);

  const fetchItems = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("items")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (!error && data) setItems(data as DbItem[]);
  };

  const fetchSharedItems = async () => {
    if (!user) return;
    const { data: shares, error } = await supabase
      .from("shared_items")
      .select("item_id, can_edit")
      .eq("shared_with", user.id);
    
    if (error || !shares || shares.length === 0) {
      setSharedItems([]);
      return;
    }

    const itemIds = shares.map((s: any) => s.item_id);
    const { data: itemsData } = await supabase
      .from("items")
      .select("*")
      .in("id", itemIds);

    if (itemsData) {
      const mapped = itemsData.map((item: any) => ({
        ...item,
        can_edit: shares.find((s: any) => s.item_id === item.id)?.can_edit ?? false,
      }));
      setSharedItems(mapped);
    }
  };

  useEffect(() => {
    fetchItems();
    fetchSharedItems();

    const channel = supabase
      .channel("items-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "items" }, () => {
        fetchItems();
        fetchSharedItems();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "shared_items" }, () => {
        fetchSharedItems();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const handleCreate = () => {
    setEditingItem(null);
    setDialogOpen(true);
  };

  const handleEdit = (item: DbItem) => {
    setEditingItem(item);
    setDialogOpen(true);
  };

  const handleSave = async (data: { name: string; description: string }) => {
    if (!user) return;
    if (editingItem) {
      const { error } = await supabase
        .from("items")
        .update({ name: data.name, description: data.description })
        .eq("id", editingItem.id);
      if (error) toast.error("Error al actualizar");
      else { toast.success("Elemento actualizado"); fetchItems(); }
    } else {
      const { error } = await supabase
        .from("items")
        .insert({ name: data.name, description: data.description, user_id: user.id });
      if (error) toast.error("Error al crear");
      else { toast.success("Elemento creado"); fetchItems(); }
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("items").delete().eq("id", deleteId);
    if (error) toast.error("Error al eliminar");
    else { toast.success("Elemento eliminado"); fetchItems(); }
    setDeleteId(null);
  };

  const renderTable = (list: (DbItem & { can_edit?: boolean })[], isShared = false) => (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead className="hidden sm:table-cell">Descripción</TableHead>
            <TableHead className="w-[120px] text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="font-medium">
                {item.name}
                {isShared && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {item.can_edit ? "Editable" : "Solo lectura"}
                  </Badge>
                )}
              </TableCell>
              <TableCell className="hidden text-muted-foreground sm:table-cell">
                {item.description || "—"}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  {!isShared && (
                    <Button variant="ghost" size="icon" onClick={() => setShareItem({ id: item.id, name: item.name })} aria-label="Compartir">
                      <Share2 className="h-4 w-4" />
                    </Button>
                  )}
                  {(!isShared || item.can_edit) && (
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(item)} aria-label="Editar">
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                  {!isShared && (
                    <Button variant="ghost" size="icon" onClick={() => setDeleteId(item.id)} aria-label="Eliminar" className="text-destructive hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  const emptyState = (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
      <Package className="mb-4 h-12 w-12 text-muted-foreground/50" />
      <p className="text-lg font-medium text-muted-foreground">No hay elementos aún</p>
      <p className="mt-1 text-sm text-muted-foreground/70">Crea tu primer elemento para empezar</p>
      <Button onClick={handleCreate} variant="outline" className="mt-4">
        <Plus className="mr-2 h-4 w-4" /> Crear elemento
      </Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-12">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Mis Elementos</h1>
            <p className="mt-1 text-sm text-muted-foreground">{user?.email}</p>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button onClick={handleCreate} size="default">
              <Plus className="mr-2 h-4 w-4" /> Nuevo
            </Button>
            <Button variant="ghost" size="icon" onClick={signOut} aria-label="Cerrar sesión">
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <Tabs defaultValue="mine" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="mine">Mis elementos ({items.length})</TabsTrigger>
            <TabsTrigger value="shared">Compartidos ({sharedItems.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="mine">
            {items.length === 0 ? emptyState : renderTable(items)}
          </TabsContent>
          <TabsContent value="shared">
            {sharedItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
                <Share2 className="mb-4 h-12 w-12 text-muted-foreground/50" />
                <p className="text-lg font-medium text-muted-foreground">Nada compartido contigo</p>
                <p className="mt-1 text-sm text-muted-foreground/70">Cuando alguien comparta un elemento contigo, aparecerá aquí</p>
              </div>
            ) : renderTable(sharedItems, true)}
          </TabsContent>
        </Tabs>
      </div>

      <ItemDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSave={handleSave}
        item={editingItem ? { id: editingItem.id, name: editingItem.name, description: editingItem.description, createdAt: new Date(editingItem.created_at) } : null}
      />

      {shareItem && (
        <ShareDialog
          open={!!shareItem}
          onOpenChange={(open) => !open && setShareItem(null)}
          itemId={shareItem.id}
          itemName={shareItem.name}
        />
      )}

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar elemento?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Index;
