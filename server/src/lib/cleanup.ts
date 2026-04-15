import prisma from './prisma';

/**
 * Deletes conversations (+ messages via cascade) for guests who have checked out.
 * Also frees staff from any incomplete requests tied to checked-out guests.
 * Runs on startup and every hour thereafter.
 */
export async function cleanupCheckedOutData(): Promise<void> {
  try {
    const now = new Date();

    // Close conversations for checked-out guests
    const convResult = await prisma.conversation.updateMany({
      where: {
        status: 'active',
        guestSession: { checkOutDate: { lt: now } },
      },
      data: { status: 'closed' },
    });

    // Auto-complete in-progress requests for checked-out guests (work was presumably done)
    const inProgressResult = await prisma.serviceRequest.updateMany({
      where: {
        status: 'in_progress',
        guestSession: { checkOutDate: { lt: now } },
      },
      data: { status: 'completed' },
    });

    // Cancel any still-pending requests for checked-out guests and free the staff
    const pendingResult = await prisma.serviceRequest.updateMany({
      where: {
        status: 'pending',
        guestSession: { checkOutDate: { lt: now } },
      },
      data: { status: 'cancelled', assignedToId: null },
    });

    if (convResult.count > 0)
      console.log(`🧹 Closed ${convResult.count} conversation(s) from checked-out guests`);
    if (inProgressResult.count > 0)
      console.log(`✅ Auto-completed ${inProgressResult.count} in-progress request(s) after checkout`);
    if (pendingResult.count > 0)
      console.log(`❌ Cancelled ${pendingResult.count} pending request(s) after checkout`);

    // Remove orphaned ConversationFlowState records (conversations that were closed/expired)
    const flowStateResult = await prisma.conversationFlowState.deleteMany({
      where: {
        conversation: { status: { not: 'active' } },
      },
    });
    if (flowStateResult.count > 0)
      console.log(`🗑️  Deleted ${flowStateResult.count} orphaned flow state(s)`);

    // Delete notifications older than 30 days
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const notifResult = await prisma.notification.deleteMany({
      where: { createdAt: { lt: thirtyDaysAgo } },
    });
    if (notifResult.count > 0)
      console.log(`🗑️  Deleted ${notifResult.count} old notification(s)`);
  } catch (err) {
    console.error('Cleanup error:', err);
  }
}

export function startCleanupJob(): void {
  // Run immediately on startup
  cleanupCheckedOutData();
  // Then every hour
  setInterval(cleanupCheckedOutData, 60 * 60 * 1000);
}
