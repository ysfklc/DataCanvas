import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { TopBar } from "@/components/layout/top-bar";
import { UserForm } from "@/components/forms/user-form";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Edit, Trash2, Users as UsersIcon } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import type { User } from "@shared/schema";

export default function UsersPage() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const { user: currentUser } = useAuth();

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["/api/users"],
  });

  const handleCreateUser = () => {
    setIsCreateDialogOpen(true);
  };

  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setIsEditDialogOpen(true);
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "admin":
        return "default";
      case "standard":
        return "secondary";
      default:
        return "outline";
    }
  };

  const getStatusColor = (isActive: boolean) => {
    return isActive ? "text-chart-2" : "text-muted-foreground";
  };

  const isAdmin = currentUser?.role === "admin";

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <TopBar 
        title="User Management"
        onSidebarToggle={() => {}}
        showCreateButton={isAdmin}
        onCreateClick={handleCreateUser}
        createButtonText="Add User"
      />
      
      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <Card>
            <CardContent className="p-6">
              <div className="animate-pulse space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-muted rounded-full"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-muted rounded w-1/4"></div>
                      <div className="h-3 bg-muted rounded w-1/6"></div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (users as User[]).length === 0 ? (
          <div className="text-center py-12">
            <UsersIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No users found</h3>
            <p className="text-muted-foreground mb-4">
              {isAdmin ? "Add your first user to get started" : "No users to display"}
            </p>
            {isAdmin && (
              <Button onClick={handleCreateUser} data-testid="button-create-first-user">
                <UserPlus className="w-4 h-4 mr-2" />
                Add User
              </Button>
            )}
          </div>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-4 font-medium text-muted-foreground">User</th>
                      <th className="text-left p-4 font-medium text-muted-foreground">Role</th>
                      <th className="text-left p-4 font-medium text-muted-foreground">Auth Method</th>
                      <th className="text-left p-4 font-medium text-muted-foreground">Last Login</th>
                      <th className="text-left p-4 font-medium text-muted-foreground">Status</th>
                      <th className="text-left p-4 font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(users as User[]).map((user: User) => (
                      <tr key={user.id} className="border-b border-border hover:bg-muted/30" data-testid={`row-user-${user.id}`}>
                        <td className="p-4">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                              <span className="text-primary-foreground font-medium">
                                {user.username.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <div className="font-medium text-foreground" data-testid={`text-user-name-${user.id}`}>
                                {user.username}
                              </div>
                              <div className="text-sm text-muted-foreground" data-testid={`text-user-email-${user.id}`}>
                                {user.email}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <Badge variant={getRoleBadgeVariant(user.role)} data-testid={`badge-user-role-${user.id}`}>
                            {user.role === "admin" ? "Administrator" : "Standard User"}
                          </Badge>
                        </td>
                        <td className="p-4 text-foreground capitalize" data-testid={`text-user-auth-method-${user.id}`}>
                          {user.authMethod}
                        </td>
                        <td className="p-4 text-muted-foreground" data-testid={`text-user-last-login-${user.id}`}>
                          {user.lastLogin 
                            ? new Date(user.lastLogin).toLocaleDateString()
                            : "Never"
                          }
                        </td>
                        <td className="p-4">
                          <span className={`flex items-center ${getStatusColor(user.isActive)}`} data-testid={`status-user-${user.id}`}>
                            <div className="w-2 h-2 bg-current rounded-full mr-2"></div>
                            {user.isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="flex space-x-2">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-muted-foreground hover:text-foreground p-1"
                              onClick={() => handleEditUser(user)}
                              data-testid={`button-edit-user-${user.id}`}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-muted-foreground hover:text-destructive p-1"
                              disabled={user.id === currentUser?.id}
                              data-testid={`button-delete-user-${user.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add User</DialogTitle>
          </DialogHeader>
          <UserForm 
            onSuccess={() => setIsCreateDialogOpen(false)}
            onCancel={() => setIsCreateDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>
          <UserForm 
            user={selectedUser}
            onSuccess={() => setIsEditDialogOpen(false)}
            onCancel={() => setIsEditDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
