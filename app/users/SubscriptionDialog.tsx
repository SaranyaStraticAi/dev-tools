'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { updateUserStatus } from './actions';
import { Settings2 } from 'lucide-react';


// If sonner isn't installed I'll use a simple alert or just log for now to be safe, 
// wait, I don't know if toast is available. I'll skip toast for now to avoid errors and just use state.

export function SubscriptionStatusDialog({ email, currentStatus, currentPlan }: { email: string, currentStatus: string | null, currentPlan: string | null }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedCommand, setSelectedCommand] = useState('trial-new');

  const handleSave = async () => {
    setLoading(true);
    try {
      await updateUserStatus(email, selectedCommand);
      setOpen(false);
    } catch (error) {
      console.error('Failed to update status', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" className="h-8 w-8 hover:bg-gray-100 dark:hover:bg-gray-800" title="Manage Subscription">
          <Settings2 className="h-4 w-4 text-gray-600 dark:text-gray-400" />
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-white dark:bg-gray-900 sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Manage Subscription</DialogTitle>
          <DialogDescription>
            Update subscription status for <span className="font-medium text-gray-900 dark:text-white">{email}</span>.
            This will modify database records directly.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <RadioGroup value={selectedCommand} onValueChange={setSelectedCommand} className="grid gap-2">
            
            <div className="mb-2">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Trial Status</span>
            </div>
            <div className="flex items-center space-x-2 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800">
              <RadioGroupItem value="trial-new" id="trial-new" />
              <Label htmlFor="trial-new" className="flex-1 cursor-pointer">New Trial (Just Started)</Label>
            </div>
            <div className="flex items-center space-x-2 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800">
              <RadioGroupItem value="trial-ending" id="trial-ending" />
              <Label htmlFor="trial-ending" className="flex-1 cursor-pointer">Trial Ending (3 Days Left)</Label>
            </div>
             <div className="flex items-center space-x-2 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800">
              <RadioGroupItem value="trial-expired" id="trial-expired" />
              <Label htmlFor="trial-expired" className="flex-1 cursor-pointer">Trial Expired</Label>
            </div>

            <div className="mt-2 mb-2">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Subscription</span>
            </div>
            <div className="flex items-center space-x-2 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800">
              <RadioGroupItem value="subscribed" id="subscribed" />
              <Label htmlFor="subscribed" className="flex-1 cursor-pointer">Active Pro (Monthly)</Label>
            </div>
            <div className="flex items-center space-x-2 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800">
              <RadioGroupItem value="subscribed-yearly" id="subscribed-yearly" />
              <Label htmlFor="subscribed-yearly" className="flex-1 cursor-pointer">Active Pro (Yearly)</Label>
            </div>
            <div className="flex items-center space-x-2 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800">
              <RadioGroupItem value="canceled" id="canceled" />
              <Label htmlFor="canceled" className="flex-1 cursor-pointer">Canceled</Label>
            </div>

             <div className="mt-2 mb-2">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Other</span>
            </div>
            <div className="flex items-center space-x-2 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800">
              <RadioGroupItem value="broker-paid" id="broker-paid" />
              <Label htmlFor="broker-paid" className="flex-1 cursor-pointer">Set Broker Paid</Label>
            </div>
             <div className="flex items-center space-x-2 p-2 rounded hover:bg-red-50 dark:hover:bg-red-900/20">
              <RadioGroupItem value="reset" id="reset" className="border-red-500 text-red-500" />
              <Label htmlFor="reset" className="flex-1 cursor-pointer text-red-600 dark:text-red-400 font-medium">Reset User</Label>
            </div>

          </RadioGroup>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>Cancel</Button>
          <Button onClick={handleSave} disabled={loading}>{loading ? 'Updating...' : 'Update Status'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
