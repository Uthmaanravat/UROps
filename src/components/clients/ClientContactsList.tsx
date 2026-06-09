"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Plus, Pencil, Trash2, Mail, Phone, UserCheck } from "lucide-react"
import {
    createClientContactAction,
    updateClientContactAction,
    deleteClientContactAction
} from "@/app/(dashboard)/clients/actions"

interface Contact {
    id: string
    clientId: string
    name: string
    email: string | null
    phone: string | null
    role: string | null
    createdAt: Date
    updatedAt: Date
}

interface ClientContactsListProps {
    clientId: string
    initialContacts: Contact[]
}

export function ClientContactsList({ clientId, initialContacts }: ClientContactsListProps) {
    const [contacts, setContacts] = useState<Contact[]>(initialContacts)
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [editingContact, setEditingContact] = useState<Contact | null>(null)
    const [loading, setLoading] = useState(false)

    // Form states
    const [name, setName] = useState("")
    const [email, setEmail] = useState("")
    const [phone, setPhone] = useState("")
    const [role, setRole] = useState("")

    const openAddDialog = () => {
        setName("")
        setEmail("")
        setPhone("")
        setRole("")
        setEditingContact(null)
        setIsDialogOpen(true)
    }

    const openEditDialog = (contact: Contact) => {
        setName(contact.name)
        setEmail(contact.email || "")
        setPhone(contact.phone || "")
        setRole(contact.role || "")
        setEditingContact(contact)
        setIsDialogOpen(true)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!name.trim()) return

        setLoading(true)
        try {
            if (editingContact) {
                const updated = await updateClientContactAction({
                    id: editingContact.id,
                    name,
                    email: email || null,
                    phone: phone || null,
                    role: role || null,
                })
                // Convert Date back/serialize for display if needed
                const typedUpdated = {
                    ...updated,
                    createdAt: new Date(updated.createdAt),
                    updatedAt: new Date(updated.updatedAt)
                } as Contact
                setContacts(contacts.map(c => c.id === editingContact.id ? typedUpdated : c))
            } else {
                const created = await createClientContactAction({
                    clientId,
                    name,
                    email: email || null,
                    phone: phone || null,
                    role: role || null,
                })
                const typedCreated = {
                    ...created,
                    createdAt: new Date(created.createdAt),
                    updatedAt: new Date(created.updatedAt)
                } as Contact
                setContacts([...contacts, typedCreated])
            }
            setIsDialogOpen(false)
        } catch (error) {
            console.error(error)
            alert("Failed to save contact. Please try again.")
        } finally {
            setLoading(false)
        }
    }

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Are you sure you want to delete contact "${name}"?`)) return

        setLoading(true)
        try {
            await deleteClientContactAction(id)
            setContacts(contacts.filter(c => c.id !== id))
        } catch (error) {
            console.error(error)
            alert("Failed to delete contact. Please try again.")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Card className="shadow-sm border">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-lg font-medium">Contact Persons</CardTitle>
                <Button size="sm" onClick={openAddDialog} className="flex items-center gap-1">
                    <Plus className="h-4 w-4" /> Add Contact
                </Button>
            </CardHeader>
            <CardContent>
                {contacts.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground text-sm border-2 border-dashed rounded-lg">
                        No contact persons added yet. Click &quot;Add Contact&quot; to add one.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {contacts.map((contact) => (
                            <div key={contact.id} className="p-4 rounded-lg border bg-background hover:shadow-sm transition-all relative flex flex-col justify-between">
                                <div className="space-y-2">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <h4 className="font-semibold text-foreground text-base">{contact.name}</h4>
                                            {contact.role && (
                                                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full mt-1">
                                                    <UserCheck className="h-3 w-3" /> {contact.role}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => openEditDialog(contact)}>
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive/80" onClick={() => handleDelete(contact.id, contact.name)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="space-y-1 pt-2 text-sm text-muted-foreground">
                                        {contact.email && (
                                            <div className="flex items-center gap-2">
                                                <Mail className="h-4 w-4 shrink-0" />
                                                <a href={`mailto:${contact.email}`} className="hover:underline truncate">{contact.email}</a>
                                            </div>
                                        )}
                                        {contact.phone && (
                                            <div className="flex items-center gap-2">
                                                <Phone className="h-4 w-4 shrink-0" />
                                                <a href={`tel:${contact.phone}`} className="hover:underline">{contact.phone}</a>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{editingContact ? "Edit Contact" : "Add New Contact"}</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
                            <div className="space-y-2">
                                <Label htmlFor="contact-name">Full Name *</Label>
                                <Input
                                    id="contact-name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="e.g. John Doe"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="contact-role">Role / Position</Label>
                                <Input
                                    id="contact-role"
                                    value={role}
                                    onChange={(e) => setRole(e.target.value)}
                                    placeholder="e.g. Quantity Surveyor, Admin, Manager"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="contact-email">Email Address</Label>
                                <Input
                                    id="contact-email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="e.g. john@example.com"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="contact-phone">Phone Number</Label>
                                <Input
                                    id="contact-phone"
                                    type="tel"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    placeholder="e.g. +27 82 123 4567"
                                />
                            </div>
                            <DialogFooter className="pt-4">
                                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} disabled={loading}>
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={loading}>
                                    {loading ? "Saving..." : (editingContact ? "Save Changes" : "Add Contact")}
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </CardContent>
        </Card>
    )
}
