--
-- PostgreSQL database dump
--

-- Dumped from database version 17.4
-- Dumped by pg_dump version 17.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: alembic_version; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.alembic_version (
    version_num character varying(32) NOT NULL
);


ALTER TABLE public.alembic_version OWNER TO postgres;

--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id integer NOT NULL,
    email character varying NOT NULL,
    password character varying NOT NULL,
    reset_token character varying,
    reset_token_expires timestamp with time zone,
    email_token character varying,
    email_token_expiration timestamp with time zone,
    confirm_token character varying,
    confirm_token_expires timestamp with time zone,
    is_confirmed boolean
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Data for Name: alembic_version; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.alembic_version (version_num) FROM stdin;
cc0d67037df6
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, email, password, reset_token, reset_token_expires, email_token, email_token_expiration, confirm_token, confirm_token_expires, is_confirmed) FROM stdin;
3	maddulasaisivareddy@gmail.com	$2b$12$GL6BF3W1HXSsZf0t0J/6M.zVaQbBxoycq.Or6GwqGtyciRCsUbpFi	PqbHhV4Ky4eZXVvpcPZEq7w_Ss7vdu80XaJMOXjw1mM	2025-03-07 13:33:32.214973-05	\N	\N	\N	\N	\N
4	saithanmayee3@gmail.com	$2b$12$Hs2qIqNVganh/KreUiMUYeHIM7xtj3fM68DNYwvUdZ0fVrAW26rKe	\N	\N	\N	\N	wW-DsfeWrhlz3AYOU3N_YOaSyBf4ug-EemSFbWVqGsg	2025-04-01 12:26:16.150166-04	f
5	smaddul1@outlook.com	$2b$12$H2EOqiiLCnli1krRZA4bA.Vxs9t6DWPZXhcv6TRRxtVS6PcOALT8q	\N	\N	\N	\N	WY1I_07yv8H1_9SG2gz6roCoWV3i0PcMjIs1KrmlUoA	2025-04-01 14:33:06.680148-04	f
6	saisiva123@gmail.com	Saisiva@123	\N	\N	\N	\N	\N	\N	t
8	app@gmail.com	App@1234	\N	\N	\N	\N	\N	\N	t
10	Email@gmail.com	$2b$12$Yjdl7O8VCx.44Zv/q7wzIOKeADtJVUVr3BvuAtz6lsnOohXLU7SLW	\N	\N	\N	\N	\N	\N	t
14	signup@gmail.com	$2b$12$U0Rw8CuKD2bSCKNajQFkMe8oZ1VK2KtMuvUIBDiCFsjz.Jymuj18S	N1xwXwpRbSDic9KHSCEKU8mZTiOchH-PI3lBixQ7D94	2025-03-10 20:51:31.948395-04	\N	\N	\N	\N	t
\.


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_id_seq', 15, true);


--
-- Name: alembic_version alembic_version_pkc; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alembic_version
    ADD CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: ix_users_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX ix_users_email ON public.users USING btree (email);


--
-- Name: ix_users_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_users_id ON public.users USING btree (id);


--
-- PostgreSQL database dump complete
--

