import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth";
import { calculateMonthlyCost, getMonthlyStats } from "@/lib/r2";

export async function GET(request: NextRequest) {
  const authError = await requireAdminAuth();
  if (authError) return authError;

  try {
    const cost = await calculateMonthlyCost();
    const stats = await getMonthlyStats();
    
    return NextResponse.json({
      ...cost,
      operations: stats.operations,
      bandwidth: stats.bandwidth,
      month: stats.month,
    });
  } catch (error) {
    console.error("Error calculating costs:", error);
    return NextResponse.json(
      { error: "Failed to calculate costs" },
      { status: 500 }
    );
  }
}
