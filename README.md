# PsicoPlus

Software de gestión para consultorios de psicología: agenda de turnos, historia de pacientes, facturación y liquidaciones a los profesionales del consultorio.

**Sitio:** https://psicoplus.net.ar

## Qué hace

- **Agenda de turnos** con portal para que el paciente reserve.
- **Ficha de pacientes** y seguimiento.
- **Facturación** con generación de comprobantes en PDF.
- **Finanzas** del consultorio y **liquidaciones** por profesional.
- **Dashboard** con la actividad del mes.
- Recordatorios por WhatsApp.

## Stack

| Capa | Tecnología |
|---|---|
| Framework | React 19 + Vite 8 |
| Backend | Supabase (base de datos, auth y storage) |
| Estilos | Tailwind CSS 4 |
| PDFs | jsPDF |
| Iconos | lucide-react |
| Deploy | Vercel |

## Cómo correrlo

```bash
git clone https://github.com/nic0420/PsicoPlus.git
cd PsicoPlus
npm install
cp .env.example .env    # completar VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
npm run dev
```

## Configuración guardada en la cuenta

El perfil profesional, los datos de facturación, las sedes, los aranceles de obras sociales y el plan se guardan en Supabase por cuenta, así aparecen en cualquier navegador o dispositivo al iniciar sesión.

1. En Supabase → **SQL Editor**, ejecutar `supabase/migrations/20261104_user_settings.sql`.
2. En Vercel (y en `.env` local), cargar `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
3. Opcional: en Supabase → Authentication → Providers → Email, desactivar **Confirm email** para que la sincronización arranque apenas se crea la cuenta.

Las cuentas que existían solo en un navegador se suben a la nube la primera vez que se inicia sesión. El certificado de ARCA sigue guardándose solo en el dispositivo.

