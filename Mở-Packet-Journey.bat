@echo off
chcp 65001 >nul
rem Mo app Packet Journey: bat server HTTP o goc E:\SAP (port 8000) roi mo dung URL.
rem % trong URL phai viet thanh %% trong file .bat.
rem serve.py ep charset=utf-8 (het loi tieng Viet khi mo file .md/.html).
rem Dung duong dan tuyet doi -> chay dung du cua so mo o thu muc nao.
start "Packet Journey server" cmd /k python "E:\SAP\serve.py" 8000
timeout /t 1 >nul
start "" "http://127.0.0.1:8000/M%%E1%%BA%%A1ng%%20m%%C3%%A1y%%20t%%C3%%ADnh/Packet-Journey/"
echo.
echo Neu trinh duyet chua mo app, dan URL nay vao:
echo http://127.0.0.1:8000/M%%E1%%BA%%A1ng%%20m%%C3%%A1y%%20t%%C3%%ADnh/Packet-Journey/
echo (Dong cua so server mau den de tat server.)
