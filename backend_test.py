#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime

class PadelTournamentTester:
    def __init__(self, base_url="https://bracket-boss-1.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.admin_token = None
        self.user_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}")
        else:
            print(f"❌ {name} - {details}")
        
        self.test_results.append({
            "test": name,
            "success": success,
            "details": details
        })

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        if headers:
            test_headers.update(headers)

        print(f"\n🔍 Testing {name}...")
        print(f"   {method} {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers)

            success = response.status_code == expected_status
            
            if success:
                self.log_test(name, True)
                try:
                    return True, response.json() if response.content else {}
                except:
                    return True, {}
            else:
                error_msg = f"Expected {expected_status}, got {response.status_code}"
                try:
                    error_data = response.json()
                    if 'detail' in error_data:
                        error_msg += f" - {error_data['detail']}"
                except:
                    pass
                self.log_test(name, False, error_msg)
                return False, {}

        except Exception as e:
            self.log_test(name, False, f"Request failed: {str(e)}")
            return False, {}

    def test_seed_data(self):
        """Test seeding database with sample data"""
        print("\n🌱 SEEDING DATABASE")
        success, response = self.run_test(
            "Seed Database",
            "POST",
            "seed",
            200
        )
        return success

    def test_admin_login(self):
        """Test admin login"""
        print("\n🔐 AUTHENTICATION TESTS")
        success, response = self.run_test(
            "Admin Login",
            "POST",
            "auth/login",
            200,
            data={"email": "admin@padel.com", "password": "admin123"}
        )
        if success and 'token' in response:
            self.admin_token = response['token']
            return True
        return False

    def test_user_login(self):
        """Test user login"""
        success, response = self.run_test(
            "User Login",
            "POST",
            "auth/login",
            200,
            data={"email": "juan@test.com", "password": "test123"}
        )
        if success and 'token' in response:
            self.user_token = response['token']
            return True
        return False

    def test_user_registration(self):
        """Test user registration"""
        timestamp = datetime.now().strftime("%H%M%S")
        success, response = self.run_test(
            "User Registration",
            "POST",
            "auth/register",
            200,
            data={
                "first_name": "Test",
                "last_name": "User",
                "email": f"test{timestamp}@test.com",
                "password": "test123"
            }
        )
        return success

    def test_auth_me(self):
        """Test getting current user info"""
        if not self.admin_token:
            self.log_test("Auth Me", False, "No admin token available")
            return False
            
        success, response = self.run_test(
            "Get Current User",
            "GET",
            "auth/me",
            200,
            headers={"Authorization": f"Bearer {self.admin_token}"}
        )
        return success

    def test_tournaments_crud(self):
        """Test tournament CRUD operations"""
        print("\n🏆 TOURNAMENT TESTS")
        
        if not self.admin_token:
            self.log_test("Tournament CRUD", False, "No admin token available")
            return False

        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        # Get tournaments
        success, tournaments = self.run_test(
            "Get Tournaments",
            "GET",
            "tournaments",
            200
        )
        if not success:
            return False

        # Create tournament
        tournament_data = {
            "name": "Test Tournament API",
            "category": "4ta",
            "date": "2024-12-25",
            "max_capacity": 8,
            "description": "Test tournament created via API"
        }
        
        success, created_tournament = self.run_test(
            "Create Tournament",
            "POST",
            "tournaments",
            200,
            data=tournament_data,
            headers=headers
        )
        
        if not success:
            return False
            
        tournament_id = created_tournament.get('tournament_id')
        if not tournament_id:
            self.log_test("Create Tournament", False, "No tournament_id in response")
            return False

        # Get specific tournament
        success, tournament = self.run_test(
            "Get Tournament by ID",
            "GET",
            f"tournaments/{tournament_id}",
            200
        )
        
        # Update tournament
        update_data = {
            "name": "Updated Test Tournament",
            "description": "Updated description"
        }
        
        success, updated = self.run_test(
            "Update Tournament",
            "PUT",
            f"tournaments/{tournament_id}",
            200,
            data=update_data,
            headers=headers
        )

        # Delete tournament
        success, _ = self.run_test(
            "Delete Tournament",
            "DELETE",
            f"tournaments/{tournament_id}",
            200,
            headers=headers
        )
        
        return success

    def test_tournament_registration(self):
        """Test tournament registration flow"""
        print("\n📝 REGISTRATION TESTS")
        
        if not self.user_token:
            self.log_test("Tournament Registration", False, "No user token available")
            return False

        headers = {"Authorization": f"Bearer {self.user_token}"}
        
        # Get open tournaments
        success, tournaments = self.run_test(
            "Get Open Tournaments",
            "GET",
            "tournaments?status=open",
            200
        )
        
        if not success or not tournaments:
            self.log_test("Tournament Registration", False, "No open tournaments found")
            return False
            
        tournament_id = tournaments[0]['tournament_id']
        
        # Register for tournament
        success, _ = self.run_test(
            "Register for Tournament",
            "POST",
            f"tournaments/{tournament_id}/register",
            200,
            headers=headers
        )
        
        if not success:
            return False
            
        # Check registration status
        success, check_result = self.run_test(
            "Check Registration Status",
            "GET",
            f"registrations/check/{tournament_id}",
            200,
            headers=headers
        )
        
        if not success:
            return False
            
        # Get tournament registrations
        success, registrations = self.run_test(
            "Get Tournament Registrations",
            "GET",
            f"tournaments/{tournament_id}/registrations",
            200,
            headers=headers
        )
        
        # Cancel registration
        success, _ = self.run_test(
            "Cancel Registration",
            "DELETE",
            f"tournaments/{tournament_id}/register",
            200,
            headers=headers
        )
        
        return success

    def test_bracket_generation(self):
        """Test bracket generation"""
        print("\n🎯 BRACKET TESTS")
        
        if not self.admin_token:
            self.log_test("Bracket Generation", False, "No admin token available")
            return False

        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        # Find tournament with registrations
        success, tournaments = self.run_test(
            "Get Tournaments for Bracket",
            "GET",
            "tournaments",
            200
        )
        
        if not success:
            return False
            
        # Find tournament with enough registrations
        suitable_tournament = None
        for tournament in tournaments:
            if tournament['status'] == 'open' and tournament['current_registrations'] >= 2:
                suitable_tournament = tournament
                break
                
        if not suitable_tournament:
            self.log_test("Bracket Generation", False, "No tournament with enough registrations")
            return False
            
        tournament_id = suitable_tournament['tournament_id']
        
        # Generate bracket
        success, _ = self.run_test(
            "Generate Bracket",
            "POST",
            f"tournaments/{tournament_id}/generate-bracket",
            200,
            headers=headers
        )
        
        if not success:
            return False
            
        # Get matches
        success, matches = self.run_test(
            "Get Tournament Matches",
            "GET",
            f"tournaments/{tournament_id}/matches",
            200
        )
        
        return success

    def test_user_management(self):
        """Test user management endpoints"""
        print("\n👥 USER MANAGEMENT TESTS")
        
        if not self.admin_token:
            self.log_test("User Management", False, "No admin token available")
            return False

        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        # Get users
        success, users = self.run_test(
            "Get Users List",
            "GET",
            "users",
            200,
            headers=headers
        )
        
        if not success or not users:
            return False
            
        # Get specific user
        user_id = users[0]['user_id']
        success, user = self.run_test(
            "Get User by ID",
            "GET",
            f"users/{user_id}",
            200,
            headers=headers
        )
        
        return success

    def test_ranking(self):
        """Test ranking endpoint"""
        print("\n🏅 RANKING TESTS")
        
        success, ranking = self.run_test(
            "Get Ranking",
            "GET",
            "ranking",
            200
        )
        
        return success

    def run_all_tests(self):
        """Run all tests"""
        print("🚀 Starting Padel Tournament API Tests")
        print(f"📍 Base URL: {self.base_url}")
        
        # Seed database first
        if not self.test_seed_data():
            print("❌ Failed to seed database, continuing with existing data...")
        
        # Authentication tests
        admin_login_success = self.test_admin_login()
        user_login_success = self.test_user_login()
        
        if admin_login_success:
            self.test_auth_me()
        
        self.test_user_registration()
        
        # Core functionality tests
        if admin_login_success:
            self.test_tournaments_crud()
            self.test_user_management()
            
        if user_login_success:
            self.test_tournament_registration()
            
        if admin_login_success:
            self.test_bracket_generation()
            
        self.test_ranking()
        
        # Print summary
        print(f"\n📊 TEST SUMMARY")
        print(f"Tests run: {self.tests_run}")
        print(f"Tests passed: {self.tests_passed}")
        print(f"Success rate: {(self.tests_passed/self.tests_run*100):.1f}%")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
            return 0
        else:
            print(f"⚠️  {self.tests_run - self.tests_passed} tests failed")
            return 1

def main():
    tester = PadelTournamentTester()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())