import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/src/components/layout/AppShell';
import { AdminFoodsPage } from '@/src/features/admin/AdminFoodsPage';
import { AuthPage } from '@/src/features/auth/AuthPage';
import { BmiCalculatorPage } from '@/src/features/bmi/BmiCalculatorPage';
import { DashboardPage } from '@/src/features/dashboard/DashboardPage';
import { FoodDiaryPage } from '@/src/features/diary/FoodDiaryPage';
import { EnergyCalculatorPage } from '@/src/features/energy/EnergyCalculatorPage';
import { FoodDetailPage } from '@/src/features/foods/FoodDetailPage';
import { FoodsPage } from '@/src/features/foods/FoodsPage';
import { NutrientGroupsPage } from '@/src/features/foods/NutrientGroupsPage';
import { GoalsPage } from '@/src/features/goals/GoalsPage';
import { HomePage } from '@/src/features/home/HomePage';
import { MealPlannerPage } from '@/src/features/meal-planner/MealPlannerPage';
import { NutritionPlanPage } from '@/src/features/nutrition/NutritionPlanPage';
import { ProfilePage } from '@/src/features/profile/ProfilePage';
import { FoodScannerPage } from '@/src/features/scanner/FoodScannerPage';
import { ShoppingListPage } from '@/src/features/shopping-list/ShoppingListPage';
import { AdminRoute } from './AdminRoute';
import { ProtectedRoute } from './ProtectedRoute';

export function AppRouter() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/bmi" element={<BmiCalculatorPage />} />
        <Route path="/energy" element={<EnergyCalculatorPage />} />
        <Route path="/nutrition-plan" element={<NutritionPlanPage />} />
        <Route path="/foods" element={<FoodsPage />} />
        <Route path="/foods/:id" element={<FoodDetailPage />} />
        <Route path="/nutrients" element={<NutrientGroupsPage />} />
        <Route path="/login" element={<AuthPage />} />
        <Route
          path="/meal-planner"
          element={
            <ProtectedRoute>
              <MealPlannerPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/scanner"
          element={
            <ProtectedRoute>
              <FoodScannerPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/goals"
          element={
            <ProtectedRoute>
              <GoalsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/diary"
          element={
            <ProtectedRoute>
              <FoodDiaryPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/shopping-list"
          element={
            <ProtectedRoute>
              <ShoppingListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/foods"
          element={
            <AdminRoute>
              <AdminFoodsPage />
            </AdminRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}
