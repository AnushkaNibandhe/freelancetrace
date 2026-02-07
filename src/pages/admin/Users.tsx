import React, { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Search, MoreVertical, Shield, Ban, CheckCircle2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useProfiles, useUpdateProfile } from '@/hooks/useProfiles';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

const AdminUsers: React.FC = () => {
  const { data: profiles, isLoading } = useProfiles();
  const updateProfile = useUpdateProfile();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');

  const filteredUsers = React.useMemo(() => {
    let users = profiles || [];
    
    // Filter by role
    if (activeTab === 'freelancers') {
      users = users.filter(u => u.role === 'freelancer');
    } else if (activeTab === 'clients') {
      users = users.filter(u => u.role === 'client');
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      users = users.filter(u => 
        u.full_name?.toLowerCase().includes(query) ||
        u.email.toLowerCase().includes(query) ||
        u.organization_name?.toLowerCase().includes(query)
      );
    }

    return users;
  }, [profiles, activeTab, searchQuery]);

  const handleToggleSuspend = async (userId: string, currentStatus: boolean) => {
    try {
      await updateProfile.mutateAsync({
        id: userId,
        is_suspended: !currentStatus
      });
      toast({
        title: currentStatus ? 'User unsuspended' : 'User suspended',
        description: `The user has been ${currentStatus ? 'unsuspended' : 'suspended'} successfully.`
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update user status',
        variant: 'destructive'
      });
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <div><h1 className="text-3xl font-bold">Users</h1><p className="text-muted-foreground mt-1">Manage platform users</p></div>
          <Skeleton className="h-10 w-full max-w-md" />
          <Skeleton className="h-96" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div><h1 className="text-3xl font-bold">Users</h1><p className="text-muted-foreground mt-1">Manage platform users</p></div>
        <div className="flex gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search users..." 
              className="pl-10" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="all">All ({profiles?.length || 0})</TabsTrigger>
            <TabsTrigger value="freelancers">Freelancers ({profiles?.filter(p => p.role === 'freelancer').length || 0})</TabsTrigger>
            <TabsTrigger value="clients">Clients ({profiles?.filter(p => p.role === 'client').length || 0})</TabsTrigger>
          </TabsList>
          <TabsContent value={activeTab} className="mt-6">
            <Card>
              <CardContent className="p-0">
                {filteredUsers.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No users found</p>
                ) : (
                  <div className="divide-y divide-border">
                    {filteredUsers.map((user) => (
                      <div key={user.id} className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-4">
                          <Avatar>
                            <AvatarImage src={user.avatar_url || undefined} />
                            <AvatarFallback className="bg-primary/10 text-primary">
                              {(user.full_name || user.email).charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{user.full_name || user.email}</p>
                              {user.is_verified && <CheckCircle2 className="h-4 w-4 text-success" />}
                              {user.is_suspended && <Badge variant="destructive">Suspended</Badge>}
                            </div>
                            <p className="text-sm text-muted-foreground">{user.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <Badge variant="outline" className="capitalize">{user.role}</Badge>
                          <span className="text-sm">★ {user.trust_score?.toFixed(1) || '0.0'}</span>
                          <span className="text-sm text-muted-foreground">{user.projects_completed || 0} projects</span>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem><Shield className="mr-2 h-4 w-4" />View Profile</DropdownMenuItem>
                              <DropdownMenuItem 
                                className="text-destructive"
                                onClick={() => handleToggleSuspend(user.id, user.is_suspended || false)}
                              >
                                <Ban className="mr-2 h-4 w-4" />
                                {user.is_suspended ? 'Unsuspend' : 'Suspend'}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default AdminUsers;
