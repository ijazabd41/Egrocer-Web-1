import requests

url = "http://cooperp.freeddns.org:8076"
session = requests.Session()
login_data = {
    "jsonrpc": "2.0",
    "params": {
        "db": "staging-apr17",
        "login": "storekeeper2@eicoop.ae1",
        "password": "dds@123"
    }
}
login_res = session.post(f"{url}/web/session/authenticate", json=login_data)
print("Login Status:", login_res.status_code)
# Get session_id from cookies
cookies = session.cookies.get_dict()
print("Cookies:", cookies)

dash_res = session.get(f"{url}/api/stock/dashboard?by_AJR=1&period=all")
print("Dash Status:", dash_res.status_code)
try:
    print("Dash JSON:", str(dash_res.json())[:500])
except Exception as e:
    print("Dash Text:", dash_res.text[:500])
