@echo off
chcp 65001 >nul
rem Mo ban clone Packet Journey trong E:\SAP\Packet-Journey (port 8008).
rem % trong URL phai viet thanh %% trong file .bat.
rem serve.py ep charset=utf-8 (het loi tieng Viet khi mo file .md/.html).
rem Dung duong dan tuyet doi -> chay dung du cua so mo o thu muc nao.
rem serve.py phai la server DA LUONG (http.server.ThreadingHTTPServer): app nap hon 100 module cung luc,
rem server 1 luong lam Chrome bao ERR_CONNECTION_REFUSED. Thay the: python -m http.server 8008 (da luong tu Python 3.7).
start "Packet Journey server" cmd /k python "E:\SAP\serve.py" 8008
timeout /t 1 >nul
start "" "http://127.0.0.1:8008/Packet-Journey/"
echo.
echo Neu trinh duyet chua mo app, dan URL nay vao:
echo http://127.0.0.1:8008/Packet-Journey/
echo (Dong cua so server mau den de tat server.)
