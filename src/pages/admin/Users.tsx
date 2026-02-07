import React from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Search, MoreVertical, Shield, Ban, CheckCircle2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const users = [
  { id: '1', name: 'Alex Chen', email: 'alex@example.com', role: 'freelancer', trustScore: 4.8, projects: 12, earnings: 45000, verified: true, suspended: false },
  { id: '2', name: 'TechCorp Inc.', email: 'contact@techcorp.com', role: 'client', trustScore: 4.5, projects: 8, spent: 125000, verified: true, suspended: false },
  { id: '3', name: 'Sarah Johnson', email: 'sarah@example.com', role: 'freelancer', trustScore: 4.9, projects: 18, earnings: 78000, verified: true, suspended: false },
  { id: '4', name: 'John Doe', email: 'john@example.com', role: 'freelancer', trustScore: 3.2, projects: 3, earnings: 8500, verified: false, suspended: true },
];

const AdminUsers: React.FC = () => {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div><h1 className="text-3xl font-bold">Users</h1><p className="text-muted-foreground mt-1">Manage platform users</p></div>
        <div className="flex gap-4">
          <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search users..." className="pl-10" /></div>
        </div>
        <Tabs defaultValue="all">
          <TabsList><TabsTrigger value="all">All</TabsTrigger><TabsTrigger value="freelancers">Freelancers</TabsTrigger><TabsTrigger value="clients">Clients</TabsTrigger></TabsList>
          <TabsContent value="all" className="mt-6">
            <Card>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {users.map((user) => (
                    <div key={user.id} className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-4">
                        <Avatar><AvatarFallback className="bg-primary/10 text-primary">{user.name.charAt(0)}</AvatarFallback></Avatar>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{user.name}</p>
                            {user.verified && <CheckCircle2 className="h-4 w-4 text-success" />}
                            {user.suspended && <Badge variant="destructive">Suspended</Badge>}
                          </div>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <Badge variant="outline" className="capitalize">{user.role}</Badge>
                        <span className="text-sm">★ {user.trustScore}</span>
                        <span className="text-sm text-muted-foreground">{user.projects} projects</span>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem><Shield className="mr-2 h-4 w-4" />View Profile</DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive"><Ban className="mr-2 h-4 w-4" />{user.suspended ? 'Unsuspend' : 'Suspend'}</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default AdminUsers;
