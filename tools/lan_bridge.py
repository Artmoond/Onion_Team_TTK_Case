"""
Мост для подключения мобильных устройств по локальной сети (Wi-Fi) к Docker WSL2.
WSL2 по умолчанию слушает только на 127.0.0.1 хоста. Этот скрипт слушает на внешнем
Wi-Fi IP компьютера и проксирует пакеты в 127.0.0.1 на соответствующие порты.
"""

import socket
import threading
import sys

def get_lan_ips():
    ips = []
    try:
        # Пробуем получить локальный IP через внешний UDP сокет (без отправки)
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        primary = s.getsockname()[0]
        s.close()
        ips.append(primary)
    except Exception:
        pass

    try:
        hostname = socket.gethostname()
        for ip in socket.gethostbyname_ex(hostname)[2]:
            if not ip.startswith("127.") and not ip.startswith("169.254.") and ip not in ips:
                ips.append(ip)
    except Exception:
        pass

    return ips

def forward_stream(source, destination):
    try:
        while True:
            data = source.recv(65536)
            if not data:
                break
            destination.sendall(data)
    except Exception:
        pass
    finally:
        try:
            source.close()
        except Exception:
            pass
        try:
            destination.close()
        except Exception:
            pass

def handle_client(client_socket, target_port):
    try:
        target_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        target_socket.connect(("127.0.0.1", target_port))
    except Exception:
        client_socket.close()
        return

    t1 = threading.Thread(target=forward_stream, args=(client_socket, target_socket), daemon=True)
    t2 = threading.Thread(target=forward_stream, args=(target_socket, client_socket), daemon=True)
    t1.start()
    t2.start()

def start_port_forward(listen_ip, port):
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    try:
        server.bind((listen_ip, port))
        server.listen(128)
    except Exception as e:
        # Если порт уже занят или недоступен
        return

    while True:
        try:
            client, _ = server.accept()
            threading.Thread(target=handle_client, args=(client, port), daemon=True).start()
        except Exception:
            break

def main():
    ports = [80, 3000, 3001, 8000]
    lan_ips = get_lan_ips()
    if not lan_ips:
        print("Не удалось определить LAN IP.")
        sys.exit(1)

    print("============================================================")
    print("🌐 Wi-Fi Bridge для подключения с мобильных устройств запущен!")
    print("============================================================")
    for ip in lan_ips:
        print(f"Адрес вашего компьютера в сети Wi-Fi: {ip}")
        print(f"  📱 Мобильный клиент (Шлюз):   http://{ip}/")
        print(f"  📱 Мобильный клиент (Порт):   http://{ip}:3000/")
        print(f"  🛠 Студия организатора:      http://{ip}:3001/")
        print(f"  🚀 Бэкенд API:                http://{ip}:8000/docs")
        print("------------------------------------------------------------")
        for port in ports:
            threading.Thread(target=start_port_forward, args=(ip, port), daemon=True).start()

    print("Подключите телефон к ТОМУ ЖЕ Wi-Fi и откройте ссылку выше в мобильном браузере.")
    print("Для завершения нажмите Ctrl+C.")
    try:
        threading.Event().wait()
    except KeyboardInterrupt:
        print("Остановка моста...")

if __name__ == "__main__":
    main()
