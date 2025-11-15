import requests
import json

response = requests.post(
    "http://localhost:3001/api/auth/login",
    json={"email": "headcampusaura@gmail.com", "password": "admin123"},
    headers={"Content-Type": "application/json"}
)

print("Status:", response.status_code)
print("\nResponse JSON:")
data = response.json()
print(json.dumps(data, indent=2))
print(f"\nUser role: '{data['user']['role']}'")
print(f"Role type: {type(data['user']['role'])}")
print(f"Role length: {len(data['user']['role'])}")
print(f"Role repr: {repr(data['user']['role'])}")
print(f"Role == 'Admin': {data['user']['role'] == 'Admin'}")
